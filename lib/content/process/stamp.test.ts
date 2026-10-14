import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashJson } from './canonical'
import { checkStamp, partLabel, readStamp, stampPath, writeStamp, type Stamp } from './stamp'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rr-stamp-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function stamp(over: Partial<Stamp> = {}): Stamp {
  const inputs = { brief: 'b1', timeline: 't1' }
  const outputs = { slug: 'film' }
  return {
    step: 'brief', slug: 'film', inputsSha256: hashJson(inputs), rulesVersion: 'r'.repeat(64), verdict: 'pass', problems: [],
    at: '2026-10-14T12:00:00.000Z', builder: 'claude', machine: 'm', gitHead: null, inputs, outputs, outputsSha256: hashJson(outputs), status: 'built', attempt: 1, ...over,
  }
}

describe('a stamp on disk', () => {
  it('lives at out/studio/<slug>/stamps/<step>.json and reads back', () => {
    const path = writeStamp(dir, stamp())
    expect(path).toBe(stampPath(dir, 'film', 'brief'))
    expect(path).toBe(join(dir, 'studio', 'film', 'stamps', 'brief.json'))
    const read = readStamp(dir, 'film', 'brief')
    expect(read.ok && read.stamp).toEqual(stamp())
  })

  it('carries what the spec lists: step, slug, inputsSha256, rulesVersion, verdict, problems, at, builder, machine, gitHead', () => {
    writeStamp(dir, stamp({ gitHead: 'abc' }))
    const raw = JSON.parse(readFileSync(stampPath(dir, 'film', 'brief'), 'utf8'))
    for (const k of ['step', 'slug', 'inputsSha256', 'rulesVersion', 'verdict', 'problems', 'at', 'builder', 'machine', 'gitHead']) expect(raw, k).toHaveProperty(k)
  })

  it('is missing when there is no file', () => {
    expect(readStamp(dir, 'film', 'voice')).toMatchObject({ ok: false, reason: 'missing' })
  })

  it('is damaged when it is not JSON, is another step\'s, or its hashes are not the hashes of what it holds', () => {
    const path = stampPath(dir, 'film', 'brief')
    mkdirSync(join(dir, 'studio', 'film', 'stamps'), { recursive: true })
    writeFileSync(path, 'nope')
    expect(readStamp(dir, 'film', 'brief')).toMatchObject({ ok: false, reason: 'damaged' })
    writeFileSync(path, JSON.stringify(stamp({ step: 'voice' })))
    expect(readStamp(dir, 'film', 'brief')).toMatchObject({ ok: false, reason: 'damaged' })
    writeFileSync(path, JSON.stringify(stamp({ inputs: { brief: 'EDITED', timeline: 't1' } })))
    expect(readStamp(dir, 'film', 'brief')).toMatchObject({ ok: false, reason: 'damaged', detail: expect.stringContaining('inputsSha256') })
    writeFileSync(path, JSON.stringify(stamp({ outputs: { slug: 'edited' } })))
    expect(readStamp(dir, 'film', 'brief')).toMatchObject({ ok: false, reason: 'damaged', detail: expect.stringContaining('outputsSha256') })
  })
})

describe('checkStamp: may a later step rely on this stamp?', () => {
  const same = { inputs: { brief: 'b1', timeline: 't1' }, rulesVersion: 'r'.repeat(64) }
  const read = (s: Stamp) => ({ ok: true as const, stamp: s })

  it('accepts a passed stamp whose inputs and rules are unchanged', () => {
    expect(checkStamp(read(stamp()), 'brief', same)).toEqual({ ok: true })
  })

  it('refuses a step that has not run', () => {
    expect(checkStamp({ ok: false, reason: 'missing', detail: 'x' }, 'brief', same)).toEqual({ ok: false, problem: 'step brief has not run: run step brief first' })
  })

  it('refuses a damaged stamp, and a step that did not pass, with the first problem', () => {
    expect(checkStamp({ ok: false, reason: 'damaged', detail: 'bad hash' }, 'brief', same)).toMatchObject({ ok: false, problem: expect.stringContaining('damaged (bad hash): run step brief again') })
    const failed = stamp({ verdict: 'fail', problems: [{ problem: 'Banned phrase "nestled"' }] })
    expect(checkStamp(read(failed), 'brief', same)).toEqual({ ok: false, problem: 'step brief did not pass (Banned phrase "nestled"): fix it and run step brief again' })
  })

  it('says the brief changed, in the words of the spec', () => {
    expect(checkStamp(read(stamp()), 'brief', { ...same, inputs: { brief: 'b2', timeline: 't1' } })).toEqual({
      ok: false,
      problem: 'the brief changed since step brief passed: run step brief again',
    })
  })

  it('names the first changed part and the others after it', () => {
    const out = checkStamp(read(stamp()), 'brief', { ...same, inputs: { brief: 'b2', timeline: 't2', 'file:ledger': 'l' } })
    expect(out).toEqual({ ok: false, problem: 'the brief changed since step brief passed: run step brief again (also changed: timeline, file ledger)' })
  })

  it('treats a part that appeared or went missing as a change', () => {
    expect(checkStamp(read(stamp()), 'brief', { ...same, inputs: { brief: 'b1' } })).toMatchObject({ ok: false, problem: expect.stringContaining('the timeline changed') })
  })

  it('refuses when the rules changed', () => {
    const out = checkStamp(read(stamp()), 'brief', { ...same, rulesVersion: 'x'.repeat(64) })
    expect(out).toMatchObject({ ok: false, problem: expect.stringMatching(/the rules changed since step brief passed .*run step brief again/) })
  })

  it('labels the parts a person reads', () => {
    expect(partLabel('step:voice')).toBe('output of step voice')
    expect(partLabel('file:clip:https://x/y.mp4')).toBe('file clip:https://x/y.mp4')
  })
})
