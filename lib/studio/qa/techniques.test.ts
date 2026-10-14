import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SIGNATURE_FLOOR_MESSAGE, evaluateTechniques, loadTechniqueRegistry, notReadyTechniques, signatureFloorProblem, techniqueProblems, unusableReason, usableTechnique, type TechniqueRegistry } from './techniques'

const registry: TechniqueRegistry = {
  hasCategories: true,
  categories: new Map([
    ['dollar_first_hook', 'hook'],
    ['subframe_motion_blur', 'scene'],
    ['eased_number_reveal', 'type'],
    ['measured_drop_sync', 'sound'],
    ['loose_idea', null],
  ]) as TechniqueRegistry['categories'],
}

describe('evaluateTechniques', () => {
  const all = ['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal']

  it('passes when every brief technique ran and hook, scene and type are covered', () => {
    const r = evaluateTechniques(all, [...all, 'measured_drop_sync'], registry)
    expect(r.pass).toBe(true)
    expect(r.byCategory.hook).toEqual(['dollar_first_hook'])
  })

  it('fails a brief technique the renderer never ran', () => {
    const r = evaluateTechniques([...all, 'measured_drop_sync'], all, registry)
    expect(r.pass).toBe(false)
    expect(r.notRun).toEqual(['measured_drop_sync'])
  })

  it('fails when a required category never ran, naming it', () => {
    const r = evaluateTechniques(['dollar_first_hook'], ['dollar_first_hook', 'measured_drop_sync'], registry)
    expect(r.pass).toBe(false)
    expect(r.missingCategories).toEqual(['scene', 'type'])
  })

  it('fails a manifest technique the registry does not list', () => {
    const r = evaluateTechniques(all, [...all, 'invented_trick'], registry)
    expect(r.pass).toBe(false)
    expect(r.unknown).toEqual(['invented_trick'])
  })

  it('does not count an uncategorized technique toward a category', () => {
    const r = evaluateTechniques(['loose_idea'], ['loose_idea', ...all], registry)
    expect(r.uncategorized).toEqual(['loose_idea'])
    expect(r.pass).toBe(true)
    const none = evaluateTechniques(['loose_idea'], ['loose_idea'], registry)
    expect(none.pass).toBe(false)
  })

  it('fails an empty brief list', () => {
    expect(evaluateTechniques([], all, registry).pass).toBe(false)
  })

  it('fails when the registry has no categories at all', () => {
    const r = evaluateTechniques(all, all, { ...registry, hasCategories: false })
    expect(r.noCategories).toBe(true)
    expect(r.pass).toBe(false)
  })
})

describe('loadTechniqueRegistry', () => {
  const dirs: string[] = []
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
  })
  const write = (obj: unknown) => {
    const d = mkdtempSync(join(tmpdir(), 'rr-reg-'))
    dirs.push(d)
    const p = join(d, 'registry.json')
    writeFileSync(p, JSON.stringify(obj))
    return p
  }

  it('reads valid categories and nulls an invalid or absent one', () => {
    const r = loadTechniqueRegistry(write({ techniques: { a: { category: 'hook' }, b: {}, c: { category: 'banana' } } }))
    expect(r.categories.get('a')).toBe('hook')
    expect(r.categories.get('b')).toBeNull()
    expect(r.categories.get('c')).toBeNull()
    expect(r.hasCategories).toBe(true)
  })

  it('reports hasCategories false when nothing has one', () => {
    expect(loadTechniqueRegistry(write({ techniques: { a: { name: 'A' } } })).hasCategories).toBe(false)
  })

  it('throws on a file with no techniques', () => {
    expect(() => loadTechniqueRegistry(write({ version: 1 }))).toThrow(/techniques/)
  })

  it('reads the real registry without throwing', () => {
    const real = loadTechniqueRegistry()
    expect(real.categories.size).toBeGreaterThan(0)
  })
})

describe('the approval rungs and the signature floor (Matt 2026-10-14)', () => {
  const rungs: TechniqueRegistry = {
    ...registry,
    status: new Map([
      ['dollar_first_hook', 'ready'],
      ['subframe_motion_blur', 'ready'],
      ['eased_number_reveal', 'approved'],
      ['measured_drop_sync', 'planned'],
    ]),
    tier: new Map([['subframe_motion_blur', 'signature']]),
  }
  const approvedSig: TechniqueRegistry = { ...rungs, status: new Map([...rungs.status!, ['subframe_motion_blur', 'approved']]) }

  it('lets a base technique run when ready or approved, and a signature only when approved', () => {
    expect(usableTechnique('dollar_first_hook', rungs)).toBe(true)
    expect(usableTechnique('eased_number_reveal', rungs)).toBe(true)
    expect(usableTechnique('measured_drop_sync', rungs)).toBe(false)
    expect(usableTechnique('subframe_motion_blur', rungs)).toBe(false)
    expect(usableTechnique('subframe_motion_blur', approvedSig)).toBe(true)
    expect(usableTechnique('invented', rungs)).toBe(false)
  })

  it('names why a technique cannot be used', () => {
    expect(notReadyTechniques(['dollar_first_hook', 'subframe_motion_blur', 'measured_drop_sync'], rungs)).toEqual(['subframe_motion_blur', 'measured_drop_sync'])
    expect(unusableReason('subframe_motion_blur', rungs)).toContain('is ready, not approved')
    expect(unusableReason('measured_drop_sync', rungs)).toContain('is planned, not ready')
    expect(unusableReason('invented', rungs)).toContain('not in the registry')
  })

  it('holds the floor: at least one approved signature technique, worded as a floor', () => {
    expect(signatureFloorProblem(['dollar_first_hook', 'subframe_motion_blur'], rungs)).toBe(SIGNATURE_FLOOR_MESSAGE)
    expect(signatureFloorProblem(['dollar_first_hook', 'subframe_motion_blur'], approvedSig)).toBeNull()
    expect(SIGNATURE_FLOOR_MESSAGE).toContain('at least one approved signature technique')
    expect(techniqueProblems(['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal'], ['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal'], rungs)).toEqual([SIGNATURE_FLOOR_MESSAGE])
  })

  it('reads tier and status from the registry file', () => {
    const r = loadTechniqueRegistry()
    expect(r.tier?.get('outline_draw_zoom')).toBe('signature')
    expect(r.tier?.get('meter_fill_verdict')).toBe('base')
    expect(r.status?.get('outline_draw_zoom')).toMatch(/^(ready|approved)$/)
  })
})
