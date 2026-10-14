import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TEST_ONLY_APPROVAL, TEST_ONLY_REEL } from './fixtures/test-approval'
import { SIGNATURE_FLOOR_MESSAGE, TEST_APPROVER, approvalFailures, evaluateTechniques, loadCheckedTechniqueRegistry, loadTechniqueRegistry, notReadyTechniques, signatureFloorProblem, techniqueProblems, unusableReason, usableTechnique, type TechniqueApproval, type TechniqueRegistry } from './techniques'

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

/** An approval that holds in the committed registry: Matt, an ISO date, a reel found on disk. */
const MATT: TechniqueApproval = { approved_by: 'matt', approved_on: '2026-10-20', reel: 'out/studio/reels/a.mp4', reelFound: true }

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
    approvals: new Map([['eased_number_reveal', MATT]]),
  }
  const approvedSig: TechniqueRegistry = {
    ...rungs,
    status: new Map([...rungs.status!, ['subframe_motion_blur', 'approved']]),
    approvals: new Map([...rungs.approvals!, ['subframe_motion_blur', MATT]]),
  }

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

describe('an approval holds only with Matt, an ISO date and a reel that exists (F1, interim)', () => {
  const base: TechniqueRegistry = {
    hasCategories: true,
    categories: new Map([['sig', 'scene']]) as TechniqueRegistry['categories'],
    status: new Map([['sig', 'approved']]),
    tier: new Map([['sig', 'signature']]),
  }
  const withApproval = (a: Partial<TechniqueApproval>, approver?: string): TechniqueRegistry => ({ ...base, approver, approvals: new Map([['sig', { ...MATT, ...a }]]) })

  it('accepts the full approval', () => {
    expect(usableTechnique('sig', withApproval({}))).toBe(true)
    expect(signatureFloorProblem(['sig'], withApproval({}))).toBeNull()
  })

  it('refuses status "approved" on its own: no approval record, a bot as approver, no date, no reel', () => {
    expect(usableTechnique('sig', base)).toBe(false)
    expect(approvalFailures('sig', base)).toEqual(['has no approval record'])
    expect(usableTechnique('sig', withApproval({ approved_by: 'claude' }))).toBe(false)
    expect(approvalFailures('sig', withApproval({ approved_by: 'claude' })).join()).toContain('approved_by is "claude", not "matt"')
    expect(usableTechnique('sig', withApproval({ approved_on: 'yesterday' }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ approved_on: '2026-02-30' }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ reel: 'x', reelFound: false }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ reel: '../outside.mp4', reelFound: true }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ reel: 'http://example.com/r.mp4', reelFound: true }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ reel: 'https://example.com/r.mp4', reelFound: null }))).toBe(false)
    expect(unusableReason('sig', withApproval({ approved_by: 'claude' }))).toContain('is marked approved but the approval does not hold')
    expect(signatureFloorProblem(['sig'], withApproval({ approved_by: 'claude' }))).toBe(SIGNATURE_FLOOR_MESSAGE)
  })

  it('takes the test approver only in a test-only registry, and never "matt" there', () => {
    expect(usableTechnique('sig', withApproval({ approved_by: TEST_APPROVER }))).toBe(false)
    expect(usableTechnique('sig', withApproval({ approved_by: TEST_APPROVER }, TEST_APPROVER))).toBe(true)
    expect(usableTechnique('sig', withApproval({}, TEST_APPROVER))).toBe(false)
  })

  describe('reading the file', () => {
    const dirs: string[] = []
    afterEach(() => {
      while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
    })
    const write = (sig: Record<string, unknown>) => {
      const d = mkdtempSync(join(tmpdir(), 'rr-reg-'))
      dirs.push(d)
      const p = join(d, 'registry.json')
      writeFileSync(p, JSON.stringify({ techniques: { sig: { category: 'scene', tier: 'signature', status: 'approved', ...sig } } }))
      return p
    }

    it('checks a repo-path reel on disk and refuses a missing one', () => {
      expect(usableTechnique('sig', loadTechniqueRegistry(write({ ...TEST_ONLY_APPROVAL }), { testOnly: true }))).toBe(true)
      expect(usableTechnique('sig', loadTechniqueRegistry(write({ ...TEST_ONLY_APPROVAL })))).toBe(false)
      expect(usableTechnique('sig', loadTechniqueRegistry(write({ ...TEST_ONLY_APPROVAL, reel: 'out/studio/reels/never-rendered.mp4' }), { testOnly: true }))).toBe(false)
      const forged = loadTechniqueRegistry(write({ approved_by: 'matt', approved_on: '2026-10-14', reel: 'out/studio/reels/never-rendered.mp4' }))
      expect(approvalFailures('sig', forged).join()).toContain('is not a file in this checkout')
      expect(TEST_ONLY_REEL.startsWith('lib/')).toBe(true)
    })

    it('HEAD-checks an https reel with a timeout', async () => {
      const path = write({ approved_by: TEST_APPROVER, approved_on: '2026-10-14', reel: 'https://reels.example.com/sig.mp4' })
      const calls: string[] = []
      const ok = (async (url: string, init: { method: string }) => {
        calls.push(`${init.method} ${url}`)
        return new Response(null, { status: 200 })
      }) as unknown as typeof fetch
      expect(usableTechnique('sig', await loadCheckedTechniqueRegistry(path, { testOnly: true, fetchImpl: ok }))).toBe(true)
      expect(calls).toEqual(['HEAD https://reels.example.com/sig.mp4'])
      const missing = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
      expect(usableTechnique('sig', await loadCheckedTechniqueRegistry(path, { testOnly: true, fetchImpl: missing }))).toBe(false)
      const stalled = ((_: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch
      const r = await loadCheckedTechniqueRegistry(path, { testOnly: true, fetchImpl: stalled, timeoutMs: 20 })
      expect(approvalFailures('sig', r).join()).toContain('did not answer a HEAD request')
      // Unchecked (the sync loader) is not approved either.
      expect(approvalFailures('sig', loadTechniqueRegistry(path, { testOnly: true })).join()).toContain('was not HEAD-checked')
    })
  })
})
