import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import {
  checkTemplateVoice,
  scanTemplateField,
  TEMPLATE_BANNED_PUNCTUATION,
  TEMPLATE_BANNED_WORDS,
} from './templateVoiceCheck'

describe('scanTemplateField', () => {
  it('returns nothing for clean copy', () => {
    expect(scanTemplateField('body', 'Your Bend home search is ready. Reply any time.')).toEqual([])
  })

  it('flags an em-dash', () => {
    const v = scanTemplateField('subject', 'Your home search — ready now')
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ field: 'subject', term: '—', kind: 'punctuation' })
  })

  it('flags an en-dash and a semicolon', () => {
    const v = scanTemplateField('body', 'Range 400–500k; call us')
    expect(v.map((x) => x.term).sort()).toEqual([';', '–'])
  })

  it('flags a banned word case-insensitively on a word boundary', () => {
    const v = scanTemplateField('body', 'This STUNNING home is ready')
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ term: 'stunning', kind: 'word' })
  })

  it('does not false-trigger on a banned word embedded in another word', () => {
    // "boasts" must not match inside "boastsworthy"; "truly" must not match "untruly".
    expect(scanTemplateField('body', 'boastsworthy untruly')).toEqual([])
  })

  it('flags a multi-word banned phrase', () => {
    const v = scanTemplateField('body', 'We pride ourselves on service')
    expect(v.some((x) => x.term === 'we pride ourselves on')).toBe(true)
  })

  it('treats empty/nullish text as clean', () => {
    expect(scanTemplateField('subject', '')).toEqual([])
    expect(scanTemplateField('subject', null)).toEqual([])
    expect(scanTemplateField('subject', undefined)).toEqual([])
  })
})

describe('checkTemplateVoice', () => {
  it('passes clean subject + body', () => {
    expect(checkTemplateVoice({ subject: 'Your search is set', body: 'Reply any time.' })).toEqual({
      ok: true,
    })
  })

  it('fails and reports punctuation + words together', () => {
    const r = checkTemplateVoice({ subject: 'Stunning home —', body: 'Act fast; reply now' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('brand voice')
    const terms = r.violations.map((v) => v.term)
    expect(terms).toContain('—')
    expect(terms).toContain(';')
    expect(terms).toContain('stunning')
    expect(terms).toContain('act fast')
  })

  it('ignores a subject for an SMS-style call (no subject passed)', () => {
    expect(checkTemplateVoice({ body: 'Quick question for you.' })).toEqual({ ok: true })
  })
})

describe('parity with the canonical brand-voice vocabulary', () => {
  const require = createRequire(import.meta.url)
  // Path from lib/crm/ up to repo root then into scripts/.
  const VOCAB = require('../../scripts/brand-voice-vocabulary.cjs') as {
    PUNCTUATION: Array<{ char: string }>
    BANNED_WORD_STRINGS: string[]
  }

  it('covers every hard-fail punctuation char except the allowed-once exclamation', () => {
    const canonical = VOCAB.PUNCTUATION.map((p) => p.char).filter((c) => c !== '!')
    for (const ch of canonical) {
      expect(TEMPLATE_BANNED_PUNCTUATION).toContain(ch)
    }
  })

  it('is a superset of the canonical banned word list', () => {
    const mine = new Set(TEMPLATE_BANNED_WORDS.map((w) => w.toLowerCase()))
    const missing = VOCAB.BANNED_WORD_STRINGS.filter((w) => !mine.has(w.toLowerCase()))
    expect(missing).toEqual([])
  })
})
