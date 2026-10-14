import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendLedgerEntry, buildLedgerEntry, comparedCount, findRepeat, genericSlugProblem, parseLedger, readLedger, repeatProblems, unusedCombinations, type LedgerEntry } from './ledger'
import type { TechniqueRegistry } from './techniques'

const registry: TechniqueRegistry = {
  hasCategories: true,
  categories: new Map([
    ['question_secret_hook', 'hook'],
    ['dollar_first_hook', 'hook'],
    ['subframe_motion_blur', 'scene'],
    ['loop_seam_edit', 'scene'],
    ['map_zoom', 'scene'],
    ['eased_number_reveal', 'type'],
    ['tiktok_caption_burn', 'type'],
  ]) as TechniqueRegistry['categories'],
}

let n = 0
function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  n++
  return {
    sha256: `sha${n}`.padEnd(64, '0'),
    videoType: 'listing',
    hookDevice: 'question_secret_hook',
    sceneSet: ['loop_seam_edit', 'subframe_motion_blur'],
    techniques: [],
    checkedAt: '2026-10-13T00:00:00.000Z',
    ...over,
  }
}

describe('buildLedgerEntry', () => {
  const film = { sha256: 'f'.repeat(64), videoType: 'listing', checkedAt: 'now' }

  it('takes the first hook technique and the sorted scene techniques', () => {
    const r = buildLedgerEntry({ ...film, techniques: ['eased_number_reveal', 'subframe_motion_blur', 'dollar_first_hook', 'question_secret_hook', 'loop_seam_edit'] }, registry)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.entry.hookDevice).toBe('dollar_first_hook')
      expect(r.entry.sceneSet).toEqual(['loop_seam_edit', 'subframe_motion_blur'])
      expect(r.entry.techniques).toHaveLength(5)
    }
  })

  it('says why a film cannot be compared', () => {
    expect(buildLedgerEntry({ ...film, techniques: ['subframe_motion_blur'] }, registry)).toEqual({ ok: false, reason: 'the manifest ran no hook technique' })
    expect(buildLedgerEntry({ ...film, techniques: ['dollar_first_hook'] }, registry)).toEqual({ ok: false, reason: 'the manifest ran no scene technique' })
    expect(buildLedgerEntry({ ...film, techniques: ['dollar_first_hook'] }, { ...registry, hasCategories: false })).toEqual({ ok: false, reason: 'registry has no categories' })
  })
})

describe('findRepeat', () => {
  it('flags the same hook device and the same scene set', () => {
    const earlier = entry()
    expect(findRepeat(entry(), [earlier])).toBe(earlier)
  })

  it('ignores order inside the scene set', () => {
    const earlier = entry({ sceneSet: ['subframe_motion_blur', 'loop_seam_edit'] })
    expect(findRepeat(entry(), [earlier])).toBe(earlier)
  })

  it('passes a near miss: same hook, one scene device different', () => {
    expect(findRepeat(entry(), [entry({ sceneSet: ['loop_seam_edit', 'map_zoom'] })])).toBeNull()
  })

  it('passes a near miss: same scenes, different hook', () => {
    expect(findRepeat(entry(), [entry({ hookDevice: 'dollar_first_hook' })])).toBeNull()
  })

  it('passes a scene set that is a subset or a superset', () => {
    expect(findRepeat(entry(), [entry({ sceneSet: ['loop_seam_edit'] })])).toBeNull()
    expect(findRepeat(entry(), [entry({ sceneSet: ['loop_seam_edit', 'subframe_motion_blur', 'map_zoom'] })])).toBeNull()
  })

  it('skips the line of this very file (the same sha256 and slug)', () => {
    const me = entry({ slug: 'bend-plan' })
    expect(findRepeat(me, [{ ...entry(), sha256: me.sha256, slug: 'bend-plan' }])).toBeNull()
  })

  it('compares only films of the same video type', () => {
    expect(findRepeat(entry(), [entry({ videoType: 'market_update' })])).toBeNull()
  })

  it('works with an empty ledger', () => {
    expect(findRepeat(entry(), [])).toBeNull()
    const earlier = entry()
    expect(findRepeat(entry(), [entry({ hookDevice: 'dollar_first_hook' }), earlier])).toBe(earlier)
  })

  it('compares against every earlier film of the type, not a recent window (F7)', () => {
    const old = entry()
    const filler = Array.from({ length: 12 }, () => entry({ hookDevice: 'dollar_first_hook' }))
    expect(findRepeat(entry(), [old, ...filler])).toBe(old)
    expect(comparedCount(entry(), [old, ...filler, entry({ videoType: 'market_update' })])).toBe(13)
  })
})

describe('the same film: the same slug AND the same one sentence (F7)', () => {
  const one = 'Bend still favors sellers, so go in with a plan.'

  it('exempts only the immediately previous version of the same film', () => {
    const v1 = entry({ slug: 'bend-plan', oneSentence: one })
    const v2 = entry({ slug: 'bend-plan', oneSentence: one })
    // v2 is a revision of v1: v1 is its previous version, so no repeat.
    expect(findRepeat(v2, [v1])).toBeNull()
    expect(comparedCount(v2, [v1])).toBe(0)
    // v3 skips only v2 (the previous version); v1 is compared and repeats.
    const v3 = entry({ slug: 'bend-plan', oneSentence: one })
    expect(findRepeat(v3, [v1, v2])).toBe(v1)
  })

  it("does not let a reused slug make a new film a revision (the review's bypass)", () => {
    // review finding: a Redmond film with slug "bend-go-in-with-a-plan" passed as a revision of the Bend film
    const bend = entry({ slug: 'bend-go-in-with-a-plan', oneSentence: one })
    const redmond = entry({ slug: 'bend-go-in-with-a-plan', oneSentence: 'Redmond is balanced, so take your time.' })
    expect(findRepeat(redmond, [bend])).toBe(bend)
    // The same sentence under another slug is another film too.
    expect(findRepeat(entry({ slug: 'redmond-plan', oneSentence: one }), [bend])).toBe(bend)
    // Older lines with no sentence are never "the same film".
    expect(findRepeat(entry({ slug: 'x-plan' }), [entry({ slug: 'x-plan' })])).not.toBeNull()
  })

  it('refuses a generic slug', () => {
    for (const slug of ['film', 'video', 'ad', 'test', 'draft', 'untitled', 'test-2', 'Final-Video', 'v3', undefined, '']) {
      expect(genericSlugProblem(slug), String(slug)).toContain('names no film')
    }
    for (const slug of ['bend-go-in-with-a-plan', 'redmond-2026-q3', 'tetherow-listing']) expect(genericSlugProblem(slug), slug).toBeNull()
    expect(repeatProblems(entry({ slug: 'film', oneSentence: one }), [], registry)).toEqual([expect.stringContaining('the slug "film" names no film')])
  })
})

describe('revisions and what is left', () => {
  it('builds the slug into the entry and reads it back', () => {
    const r = buildLedgerEntry({ sha256: 'f'.repeat(64), slug: 'bend-plan', videoType: 'listing', techniques: ['dollar_first_hook', 'map_zoom'], checkedAt: 'now' }, registry)
    expect(r.ok && r.entry.slug).toBe('bend-plan')
    const back = parseLedger(`${JSON.stringify(r.ok ? r.entry : {})}\n`)
    expect(back.entries[0].slug).toBe('bend-plan')
    expect(parseLedger('{"sha256":"a","slug":7,"videoType":"x","hookDevice":"h","sceneSet":[],"techniques":[],"checkedAt":"t"}\n').errors[0]).toContain('slug')
  })

  it('lists the ready hook and single-scene pairs the type has not used lately', () => {
    const status = new Map<string, string | null>([...registry.categories.keys()].map((k) => [k, k === 'map_zoom' ? 'planned' : 'ready']))
    const withStatus: TechniqueRegistry = { ...registry, status }
    const ledger = [entry({ hookDevice: 'dollar_first_hook', sceneSet: ['subframe_motion_blur'] })]
    const left = unusedCombinations(entry(), ledger, withStatus)
    expect(left).toContain('question_secret_hook + subframe_motion_blur')
    expect(left).toContain('dollar_first_hook + loop_seam_edit')
    expect(left).not.toContain('dollar_first_hook + subframe_motion_blur')
    expect(left.some((x) => x.includes('map_zoom'))).toBe(false)
    // A signature scene is listed only once Matt has approved it.
    const tier = new Map<string, string | null>([['loop_seam_edit', 'signature']])
    expect(unusedCombinations(entry(), ledger, { ...withStatus, tier }).some((x) => x.includes('loop_seam_edit'))).toBe(false)
    const approved = new Map(status)
    approved.set('loop_seam_edit', 'approved')
    const approvals = new Map([['loop_seam_edit', { approved_by: 'matt', approved_on: '2026-10-20', reel: 'out/studio/reels/loop.mp4', reelFound: true }]])
    expect(unusedCombinations(entry(), ledger, { ...withStatus, tier, status: approved })).not.toContain('dollar_first_hook + loop_seam_edit')
    expect(unusedCombinations(entry(), ledger, { ...withStatus, tier, status: approved, approvals })).toContain('dollar_first_hook + loop_seam_edit')
  })
})

describe('parseLedger', () => {
  it('reads lines, ignores blanks and reports bad ones', () => {
    const good = JSON.stringify(entry())
    const r = parseLedger(`${good}\n\n{bad\n${JSON.stringify({ sha256: 'x' })}\n${good}\n`)
    expect(r.entries).toHaveLength(2)
    expect(r.errors).toEqual(['line 3 is not JSON', 'line 4 is missing a ledger field'])
  })

  it('reads an empty file', () => {
    expect(parseLedger('')).toEqual({ entries: [], errors: [] })
  })
})

describe('readLedger and appendLedgerEntry', () => {
  const dirs: string[] = []
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
  })
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'rr-ledger-'))
    dirs.push(d)
    return d
  }

  it('creates an empty ledger, and its folder, when absent', () => {
    const path = join(tmp(), 'deep', 'film-ledger.jsonl')
    expect(readLedger(path)).toEqual({ entries: [], errors: [] })
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe('')
  })

  it('appends one line per film and never twice for the same slug and sha256', () => {
    const path = join(tmp(), 'l.jsonl')
    const a = entry({ slug: 'bend-plan', oneSentence: 'One sentence.' })
    expect(appendLedgerEntry(a, path)).toBe(true)
    expect(appendLedgerEntry(a, path)).toBe(false)
    expect(appendLedgerEntry(entry(), path)).toBe(true)
    const lines = readFileSync(path, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual(a)
    expect(readLedger(path).entries[0].oneSentence).toBe('One sentence.')
  })

  it('starts a new line when the file lacks a trailing newline', () => {
    const path = join(tmp(), 'l.jsonl')
    writeFileSync(path, JSON.stringify(entry()))
    appendLedgerEntry(entry(), path)
    expect(readLedger(path).entries).toHaveLength(2)
  })
})
