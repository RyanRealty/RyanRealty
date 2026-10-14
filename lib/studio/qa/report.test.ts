import { describe, expect, it } from 'vitest'
import type { CheckReport } from './check'
import { formatReport, formatValue, parseArgs } from './report'

describe('parseArgs', () => {
  it('reads the path and every option', () => {
    expect(parseArgs(['out/final.mp4', '--manifest', 'm.json', '--brief', 'b.json', '--golden', 'g.png', '--review', 'r.json', '--ledger', 'l.jsonl', '--registry', 'reg.json', '--no-contact'])).toEqual({
      mp4Path: 'out/final.mp4', manifestPath: 'm.json', briefPath: 'b.json', golden: 'g.png', reviewPath: 'r.json', ledgerPath: 'l.jsonl', registryPath: 'reg.json', final: false, contact: false,
    })
    expect(parseArgs(['out/final.mp4', '--final', '--review', 'r.json'])).toEqual({ mp4Path: 'out/final.mp4', reviewPath: 'r.json', final: true, contact: true })
  })

  it('refuses --golden, --ledger and --registry with --final', () => {
    // review finding: a final run could be pointed at a scratch ledger or a fake golden still
    expect(() => parseArgs(['a.mp4', '--final', '--golden', 'g.png'])).toThrow(/--golden cannot be used with --final/)
    expect(() => parseArgs(['a.mp4', '--ledger', 'l.jsonl', '--final'])).toThrow(/--ledger cannot be used with --final/)
    expect(() => parseArgs(['a.mp4', '--final', '--registry', 'r.json', '--golden', 'g'])).toThrow(/--golden, --registry cannot/)
  })

  it('defaults to a non-final run with a contact sheet', () => {
    expect(parseArgs(['a.mp4'])).toEqual({ mp4Path: 'a.mp4', final: false, contact: true })
  })

  it('rejects a missing path, an unknown flag, a flag with no value and a second path', () => {
    expect(() => parseArgs([])).toThrow(/required/)
    expect(() => parseArgs(['a.mp4', '--wat'])).toThrow(/unknown option/)
    expect(() => parseArgs(['a.mp4', '--manifest'])).toThrow(/needs a path/)
    expect(() => parseArgs(['a.mp4', '--manifest', '--final'])).toThrow(/needs a path/)
    expect(() => parseArgs(['a.mp4', 'b.mp4'])).toThrow(/unexpected/)
  })
})

describe('formatValue', () => {
  it('flattens values onto one line and truncates', () => {
    expect(formatValue(null)).toBe('-')
    expect(formatValue({ a: 1, b: [2, 3], c: 'x' })).toBe('a=1 b=2,3 c=x')
    expect(formatValue('y'.repeat(100), 10)).toBe('yyyyyyy...')
  })
})

describe('formatReport', () => {
  const report = (pass: boolean): CheckReport => ({
    pass, final: false, mp4: 'out/final.mp4', manifest: 'out/final.manifest.json', checkedAt: 'now', sha256: 'a'.repeat(64), ledger: null, overrides: {},
    checks: [
      { id: 1, name: 'Provenance', pass: true, measured: { sha256: 'abc' }, expected: 'x', detail: 'ok' },
      { id: 6, name: 'Motion', pass, measured: { frozen: [] }, expected: { frozenStretchUnder: 1.2 }, detail: 'frozen from 6s to 8s (2s)' },
    ],
  })

  it('prints one row per check, and why each failure failed', () => {
    const text = formatReport(report(false))
    expect(text).toContain('Provenance')
    expect(text).toMatch(/6\s+Motion\s+FAIL/)
    expect(text).toContain('6 Motion: frozen from 6s to 8s (2s)')
    expect(text).toContain('expected: frozenStretchUnder=1.2')
    expect(text).toContain('FAIL: 1 of 2 checks failed. Do not send this film.')
  })

  it('says what is left to do after a non-final pass', () => {
    const text = formatReport(report(true))
    expect(text).toContain('PASS: 2 of 2 checks passed')
    expect(text).toContain('--final')
    expect(text).not.toContain('Why it failed')
  })

  it('reports the contact sheet, labels skipped, and a failure to draw it', () => {
    const r = report(true)
    expect(formatReport(r, { path: 'a.png', frames: [], labelled: true, note: null })).toContain('contact sheet: a.png')
    expect(formatReport(r, { path: 'a.png', frames: [], labelled: false, note: 'labels skipped: no font file found' })).toContain('labels skipped: no font')
    expect(formatReport(r, { error: 'boom' })).toContain('not written (boom)')
  })

  it('lists the overrides a draft run used', () => {
    expect(formatReport({ ...report(true), overrides: { golden: 'g.png' } })).toContain('overrides used (draft run only): golden=g.png')
    expect(formatReport(report(true))).not.toContain('overrides used')
  })

  it('mentions the ledger on a recorded final pass', () => {
    const r = { ...report(true), final: true, ledger: { path: 'data/studio/film-ledger.jsonl', appended: true, entry: {} as never } }
    const text = formatReport(r)
    expect(text).toContain('added this film to data/studio/film-ledger.jsonl')
    expect(text).toContain('This film may go to Matt')
  })
})
