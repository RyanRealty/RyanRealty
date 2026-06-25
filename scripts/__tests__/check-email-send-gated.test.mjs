import { describe, it, expect } from 'vitest'
import {
  stripComments,
  findSendSites,
  enclosingScope,
  isGated,
  classifyFile,
  SEND_FNS,
} from '../check-email-send-gated.mjs'

describe('stripComments', () => {
  it('blanks a line comment but keeps the line count', () => {
    const src = 'const a = 1 // sendEmail({ ... })\nconst b = 2'
    const out = stripComments(src)
    expect(out.split('\n')).toHaveLength(2)
    expect(out).not.toMatch(/sendEmail/)
    expect(out).toMatch(/const a = 1/)
    expect(out).toMatch(/const b = 2/)
  })

  it('blanks a block/doc comment that mentions a send fn', () => {
    const src = '/**\n * Renders via `sendEmail({ react })`\n */\nfoo()'
    const out = stripComments(src)
    expect(out).not.toMatch(/sendEmail/)
    expect(out.split('\n')).toHaveLength(4)
    expect(out).toMatch(/foo\(\)/)
  })

  it('does NOT blank a sendEmail inside a string literal', () => {
    const src = 'const x = "sendEmail("'
    expect(stripComments(src)).toMatch(/sendEmail/)
  })

  it('keeps a real call that follows a // comment on the next line', () => {
    const src = '// gate first\nawait sendEmail({ to })'
    const out = stripComments(src)
    expect(out).toMatch(/sendEmail/)
    expect(out).not.toMatch(/gate first/)
  })
})

describe('findSendSites', () => {
  it('finds a sendEmail call', () => {
    const sites = findSendSites('const r = await sendEmail({ to })')
    expect(sites).toEqual([{ line: 1, fn: 'sendEmail' }])
  })

  it('finds sendBatchEmails', () => {
    const sites = findSendSites('await sendBatchEmails(list)')
    expect(sites.map((s) => s.fn)).toEqual(['sendBatchEmails'])
  })

  it('ignores the function definition line', () => {
    const src = 'export async function sendEmail(options) {\n  return client.send()\n}'
    expect(findSendSites(src)).toEqual([])
  })

  it('ignores a named import of the send fn', () => {
    expect(findSendSites("import { sendEmail } from '@/lib/resend'")).toEqual([])
  })

  it('ignores a method call like obj.sendEmail()', () => {
    expect(findSendSites('mailer.sendEmail({ to })')).toEqual([])
  })

  it('reports correct 1-based line numbers', () => {
    const src = 'line1\nline2\nawait sendEmail({})\nline4'
    expect(findSendSites(src)).toEqual([{ line: 3, fn: 'sendEmail' }])
  })

  it('exports the canonical send fn names', () => {
    expect(SEND_FNS).toContain('sendEmail')
    expect(SEND_FNS).toContain('sendBatchEmails')
  })
})

describe('enclosingScope', () => {
  it('finds the body of the function enclosing a target line', () => {
    const src = [
      'function outer() {', // 1
      '  doThing()', // 2
      '  sendEmail({})', // 3
      '}', // 4
    ].join('\n')
    const { start, end } = enclosingScope(src, 3)
    expect(start).toBe(1)
    expect(end).toBe(4)
  })

  it('does not bleed into a sibling function', () => {
    const src = [
      'function a() {', // 1
      '  isSuppressed(1)', // 2
      '}', // 3
      'function b() {', // 4
      '  sendEmail({})', // 5
      '}', // 6
    ].join('\n')
    const { start, end } = enclosingScope(src, 5)
    expect(start).toBe(4)
    expect(end).toBe(6)
  })
})

describe('isGated', () => {
  it('treats a send preceded by isSuppressed in the same function as gated', () => {
    const src = [
      'async function send() {',
      '  const g = await isSuppressed(id, "email")',
      '  if (g.suppressed) return',
      '  await sendEmail({ to })',
      '}',
    ].join('\n')
    expect(isGated(src, 4)).toBe(true)
  })

  it('treats a bare send (no isSuppressed) as ungated', () => {
    const src = ['async function send() {', '  await sendEmail({ to })', '}'].join('\n')
    expect(isGated(src, 2)).toBe(false)
  })

  it('does NOT count an isSuppressed in a sibling function as gating', () => {
    const src = [
      'function a() {',
      '  isSuppressed(1, "email")',
      '}',
      'function b() {',
      '  sendEmail({})',
      '}',
    ].join('\n')
    expect(isGated(src, 5)).toBe(false)
  })
})

describe('classifyFile', () => {
  it('returns the keyed ungated sites only', () => {
    const src = [
      'async function gated() {',
      '  const g = await isSuppressed(id, "email")',
      '  if (g.suppressed) return',
      '  await sendEmail({ to })',
      '}',
      'async function bare() {',
      '  await sendEmail({ to })',
      '}',
    ].join('\n')
    const out = classifyFile('lib/x.ts', src)
    expect(out).toEqual(['lib/x.ts:7'])
  })

  it('ignores a send mentioned only in a comment', () => {
    const src = ['/**', ' * uses sendEmail({ react })', ' */', 'function f() { noop() }'].join('\n')
    expect(classifyFile('lib/y.ts', src)).toEqual([])
  })
})
