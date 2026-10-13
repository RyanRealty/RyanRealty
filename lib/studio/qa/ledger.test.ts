import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendLedgerEntry, buildLedgerEntry, comparedCount, findRepeat, parseLedger, readLedger, type LedgerEntry } from './ledger'
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

  it('skips a line with the same sha256: it is the same film', () => {
    const me = entry()
    expect(findRepeat(me, [{ ...entry(), sha256: me.sha256 }])).toBeNull()
  })

  it('compares only films of the same video type', () => {
    expect(findRepeat(entry(), [entry({ videoType: 'market_update' })])).toBeNull()
  })

  it('works with a ledger shorter than five lines, and with none', () => {
    expect(findRepeat(entry(), [])).toBeNull()
    const earlier = entry()
    expect(findRepeat(entry(), [entry({ hookDevice: 'dollar_first_hook' }), earlier])).toBe(earlier)
  })

  it('looks only at the last five: a repeat of the sixth most recent film passes', () => {
    const old = entry()
    const filler = Array.from({ length: 5 }, () => entry({ hookDevice: 'dollar_first_hook' }))
    expect(findRepeat(entry(), [old, ...filler])).toBeNull()
    expect(findRepeat(entry(), [old, ...filler.slice(0, 4)])).toBe(old)
  })

  it('does not let same-sha lines or other types use up the five slots', () => {
    const me = entry()
    const old = entry()
    const noise = [
      { ...entry(), sha256: me.sha256 },
      entry({ videoType: 'market_update' }),
      ...Array.from({ length: 4 }, () => entry({ hookDevice: 'dollar_first_hook' })),
    ]
    expect(findRepeat(me, [old, ...noise])).toBe(old)
    expect(comparedCount(me, [old, ...noise])).toBe(5)
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

  it('appends one line per film and never twice for the same sha256', () => {
    const path = join(tmp(), 'l.jsonl')
    const a = entry()
    expect(appendLedgerEntry(a, path)).toBe(true)
    expect(appendLedgerEntry(a, path)).toBe(false)
    expect(appendLedgerEntry(entry(), path)).toBe(true)
    const lines = readFileSync(path, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual(a)
  })

  it('starts a new line when the file lacks a trailing newline', () => {
    const path = join(tmp(), 'l.jsonl')
    writeFileSync(path, JSON.stringify(entry()))
    appendLedgerEntry(entry(), path)
    expect(readLedger(path).entries).toHaveLength(2)
  })
})
