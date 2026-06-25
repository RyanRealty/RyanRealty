import { describe, it, expect } from 'vitest'
import { slugifyTemplateKey, validateTemplateInput } from './templateValidation'

describe('slugifyTemplateKey', () => {
  it('builds a channel-prefixed, url-safe key', () => {
    expect(slugifyTemplateKey('email', "BL-04 What's moving in your budget range")).toBe(
      'email-bl-04-what-s-moving-in-your-budget-range',
    )
  })

  it('collapses runs of separators and trims edges', () => {
    expect(slugifyTemplateKey('sms', '  Hello  World  ')).toBe('sms-hello-world')
  })

  it('falls back to a base when the name has no alphanumerics', () => {
    expect(slugifyTemplateKey('email', '@@@')).toBe('email-template')
  })
})

describe('validateTemplateInput', () => {
  it('accepts a clean email template', () => {
    const r = validateTemplateInput({
      channel: 'email',
      name: 'Welcome buyer',
      subject: 'Your search is set',
      body: 'Reply any time and we will help.',
      category: ' buyer ',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected ok')
    expect(r.row).toEqual({
      channel: 'email',
      name: 'Welcome buyer',
      subject: 'Your search is set',
      body: 'Reply any time and we will help.',
      category: 'buyer',
    })
  })

  it('accepts a clean sms template and forces subject to null', () => {
    const r = validateTemplateInput({
      channel: 'sms',
      name: 'Quick check-in',
      subject: 'ignored for sms',
      body: 'Quick question for you.',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected ok')
    expect(r.row.subject).toBeNull()
    expect(r.row.category).toBeNull()
  })

  it('rejects an invalid channel', () => {
    expect(validateTemplateInput({ channel: 'push', name: 'x', body: 'y' }).ok).toBe(false)
  })

  it('requires a name', () => {
    const r = validateTemplateInput({ channel: 'sms', name: '   ', body: 'hi' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('name')
  })

  it('requires a body', () => {
    const r = validateTemplateInput({ channel: 'sms', name: 'x', body: '  ' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('body')
  })

  it('requires a subject for an email template', () => {
    const r = validateTemplateInput({ channel: 'email', name: 'x', subject: '', body: 'hello' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('subject')
  })

  it('rejects a body that fails the brand-voice gate', () => {
    const r = validateTemplateInput({ channel: 'sms', name: 'x', body: 'This stunning home is great' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('brand voice')
  })

  it('rejects an email subject with an em-dash', () => {
    const r = validateTemplateInput({
      channel: 'email',
      name: 'x',
      subject: 'Your home — ready',
      body: 'clean body',
    })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected fail')
    expect(r.error).toContain('brand voice')
  })
})
