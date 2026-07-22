import { describe, expect, it } from 'vitest'
import { isAiEmailDraftKind, parseAiEmailDraft, stripHtmlToText } from './ai-email-draft'

describe('isAiEmailDraftKind', () => {
  it('accepts the five kinds and rejects everything else', () => {
    for (const k of ['introduction', 'follow_up', 'still_buying', 'custom', 'reply']) {
      expect(isAiEmailDraftKind(k)).toBe(true)
    }
    expect(isAiEmailDraftKind('sell_now')).toBe(false)
    expect(isAiEmailDraftKind('')).toBe(false)
    expect(isAiEmailDraftKind(null)).toBe(false)
    expect(isAiEmailDraftKind(7)).toBe(false)
  })
})

describe('parseAiEmailDraft', () => {
  it('splits the Subject: first line from the body', () => {
    const out = parseAiEmailDraft('Subject: Checking in on your search\n\nHi Sam, you looked at two homes last week. Want a tour of either one?')
    expect(out.subject).toBe('Checking in on your search')
    expect(out.body).toBe('Hi Sam, you looked at two homes last week. Want a tour of either one?')
  })

  it('is case-insensitive on the subject prefix and trims whitespace', () => {
    const out = parseAiEmailDraft('  SUBJECT:   Quick question  \n\n  Body here.  ')
    expect(out.subject).toBe('Quick question')
    expect(out.body).toBe('Body here.')
  })

  it('falls back to body-only when no subject line came back', () => {
    const out = parseAiEmailDraft('Hi Sam, just checking in.')
    expect(out.subject).toBe('')
    expect(out.body).toBe('Hi Sam, just checking in.')
  })

  it('keeps multi-paragraph bodies intact', () => {
    const out = parseAiEmailDraft('Subject: Two things\n\nFirst paragraph.\n\nSecond paragraph.')
    expect(out.body).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('never throws on empty input', () => {
    expect(parseAiEmailDraft('')).toEqual({ subject: '', body: '' })
  })
})

describe('stripHtmlToText', () => {
  it('flattens tags, entities, and styles to readable text', () => {
    const html = '<style>p{color:red}</style><p>Hi <b>Matt</b>,</p><p>Is the house on Awbrey still available?&nbsp;Thanks</p>'
    const out = stripHtmlToText(html)
    expect(out).toContain('Hi Matt')
    expect(out).toContain('Is the house on Awbrey still available? Thanks')
    expect(out).not.toContain('<')
    expect(out).not.toContain('color:red')
  })

  it('caps output length', () => {
    expect(stripHtmlToText('a'.repeat(5000), 100).length).toBe(100)
  })
})
