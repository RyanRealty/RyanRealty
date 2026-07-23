import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { checkBrandVoice } from './check'

describe('checkBrandVoice — string input', () => {
  it('passes clean copy', () => {
    expect(checkBrandVoice('Your Bend home search is ready. Reply any time.')).toEqual({
      ok: true,
      violations: [],
    })
  })

  it('flags an em-dash, en-dash, and semicolon', () => {
    const r = checkBrandVoice('Range 400–500k; call us — today')
    expect(r.ok).toBe(false)
    const terms = r.violations.filter((v) => v.kind === 'punctuation').map((v) => v.term)
    expect(terms.sort()).toEqual([';', '–', '—'].sort())
  })

  it('flags a banned word case-insensitively on a word boundary', () => {
    const r = checkBrandVoice('This STUNNING home is ready')
    expect(r.ok).toBe(false)
    expect(r.violations).toHaveLength(1)
    expect(r.violations[0]).toMatchObject({ term: 'stunning', kind: 'word' })
    expect(r.violations[0]!.field).toBeUndefined()
  })

  it('does not false-trigger on a banned word embedded in another word', () => {
    expect(checkBrandVoice('boastsworthy untruly')).toEqual({ ok: true, violations: [] })
  })

  it('flags a multi-word banned phrase', () => {
    const r = checkBrandVoice('We pride ourselves on service')
    expect(r.violations.some((v) => v.term === 'we pride ourselves on')).toBe(true)
  })

  it('treats an empty string as clean', () => {
    expect(checkBrandVoice('')).toEqual({ ok: true, violations: [] })
  })
})

describe('checkBrandVoice — exclamation handling', () => {
  it('bans "!" by default', () => {
    const r = checkBrandVoice('Reply today!')
    expect(r.ok).toBe(false)
    expect(r.violations).toContainEqual({ term: '!', kind: 'punctuation' })
  })

  it('allows "!" when allowExclamation is true', () => {
    const r = checkBrandVoice('Reply today!', { allowExclamation: true })
    expect(r.ok).toBe(true)
  })

  it('still bans em-dash/en-dash/semicolon when allowExclamation is true', () => {
    const r = checkBrandVoice('Reply today; call us', { allowExclamation: true })
    expect(r.ok).toBe(false)
    expect(r.violations).toContainEqual({ term: ';', kind: 'punctuation' })
  })
})

describe('checkBrandVoice — stripHtml', () => {
  it('strips HTML tags before scanning when stripHtml is true', () => {
    const html = '<p>Reply <strong>any</strong> time.</p>'
    const r = checkBrandVoice(html, { stripHtml: true })
    expect(r.ok).toBe(true)
  })

  it('a banned word hidden inside markup is still caught when stripHtml is true', () => {
    const html = '<p>This <strong>stunning</strong> home is ready</p>'
    const r = checkBrandVoice(html, { stripHtml: true })
    expect(r.ok).toBe(false)
    expect(r.violations.some((v) => v.term === 'stunning')).toBe(true)
  })

  it('without stripHtml, raw tag angle-brackets do not themselves cause a punctuation violation', () => {
    // No '<' or '>' is in the canonical punctuation set — only tag content
    // (a banned word inside a tag) can trip the word scanner either way.
    const r = checkBrandVoice('<p>Reply any time.</p>')
    expect(r.ok).toBe(true)
  })
})

describe('checkBrandVoice — object input', () => {
  it('tags each violation with its field', () => {
    const r = checkBrandVoice({ subject: 'Stunning home —', body: 'Act fast; reply now' })
    expect(r.ok).toBe(false)
    const byField = Object.fromEntries(r.violations.map((v) => [`${v.field}:${v.term}`, v]))
    expect(byField['subject:stunning']).toMatchObject({ kind: 'word', field: 'subject' })
    expect(byField['subject:—']).toMatchObject({ kind: 'punctuation', field: 'subject' })
    expect(byField['body:act fast']).toMatchObject({ kind: 'word', field: 'body' })
    expect(byField['body:;']).toMatchObject({ kind: 'punctuation', field: 'body' })
  })

  it('bodyHtml is always HTML-stripped regardless of stripHtml', () => {
    const r = checkBrandVoice({ bodyHtml: '<p>This <strong>stunning</strong> home</p>' })
    expect(r.ok).toBe(false)
    expect(r.violations[0]).toMatchObject({ field: 'bodyHtml', term: 'stunning', kind: 'word' })
  })

  it('an HTML entity in bodyText is cleaned so its semicolon does not false-fail', () => {
    const r = checkBrandVoice({ bodyText: 'Bend &amp; Redmond homes' })
    expect(r.ok).toBe(true)
  })

  it('ignores null/undefined/empty fields', () => {
    expect(checkBrandVoice({ subject: null, body: undefined, bodyHtml: '', bodyText: null })).toEqual({
      ok: true,
      violations: [],
    })
  })

  it('passes clean subject + body', () => {
    expect(checkBrandVoice({ subject: 'Your search is set', body: 'Reply any time.' })).toEqual({
      ok: true,
      violations: [],
    })
  })
})

describe('parity with the canonical brand-voice vocabulary', () => {
  const require = createRequire(import.meta.url)
  // Path from lib/voice/ up to repo root then into scripts/.
  const VOCAB = require('../../scripts/brand-voice-vocabulary.cjs') as {
    PUNCTUATION: Array<{ char: string }>
    BANNED_WORD_STRINGS: string[]
  }

  it('covers every canonical banned word (default options)', () => {
    for (const word of VOCAB.BANNED_WORD_STRINGS) {
      const r = checkBrandVoice(`This copy says ${word} right here.`)
      expect(r.ok, `expected "${word}" to be flagged`).toBe(false)
      expect(r.violations.some((v) => v.term === word.toLowerCase())).toBe(true)
    }
  })

  it('covers every canonical punctuation char except "!" (default options ban all of them, including "!")', () => {
    const canonicalExceptBang = VOCAB.PUNCTUATION.map((p) => p.char).filter((c) => c !== '!')
    for (const ch of canonicalExceptBang) {
      const r = checkBrandVoice(`Copy with a ${ch} character in it`)
      expect(r.ok, `expected "${ch}" to be flagged`).toBe(false)
      expect(r.violations.some((v) => v.term === ch)).toBe(true)
    }
    // '!' is banned by default too (allowExclamation defaults false).
    const hasBang = VOCAB.PUNCTUATION.some((p) => p.char === '!')
    expect(hasBang).toBe(true)
    const bangResult = checkBrandVoice('Copy with a ! character in it')
    expect(bangResult.ok).toBe(false)
  })

  it('allowExclamation:true still covers every OTHER canonical punctuation char', () => {
    const canonicalExceptBang = VOCAB.PUNCTUATION.map((p) => p.char).filter((c) => c !== '!')
    for (const ch of canonicalExceptBang) {
      const r = checkBrandVoice(`Copy with a ${ch} character in it`, { allowExclamation: true })
      expect(r.ok, `expected "${ch}" to be flagged even with allowExclamation:true`).toBe(false)
    }
  })
})
