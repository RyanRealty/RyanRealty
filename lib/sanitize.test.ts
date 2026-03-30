import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeHtmlWithEmbeds } from './sanitize'

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeHtml(null as unknown as string)).toBe('')
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeHtml(123 as unknown as string)).toBe('')
  })

  it('preserves safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('</script>')
    expect(result).toContain('<p>Hello</p>')
  })

  it('strips style tags', () => {
    const input = '<style>body { color: red }</style><p>Text</p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<style')
  })

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Text</p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<iframe')
  })

  it('strips event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onclick')
  })

  it('strips javascript: URIs', () => {
    const input = '<a href="javascript:alert(1)">Click</a>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('javascript:')
  })

  it('strips data: URIs from src and href attributes', () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('data:')
  })

  it('strips object and embed tags', () => {
    const input = '<object data="evil.swf"></object><embed src="evil.swf">'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
  })

  it('strips form tags', () => {
    const input = '<form action="/steal"><input></form>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<form')
  })

  it('preserves formatted content', () => {
    const input = '<h2>Title</h2><ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeHtml(input)).toBe(input)
  })
})

describe('sanitizeHtmlWithEmbeds', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtmlWithEmbeds('')).toBe('')
  })

  it('allows iframe tags', () => {
    const input = '<iframe src="https://youtube.com/embed/abc"></iframe>'
    const result = sanitizeHtmlWithEmbeds(input)
    expect(result).toContain('<iframe')
  })

  it('still strips script tags', () => {
    const input = '<script>alert(1)</script><iframe src="https://youtube.com"></iframe>'
    const result = sanitizeHtmlWithEmbeds(input)
    expect(result).not.toContain('<script')
    expect(result).toContain('<iframe')
  })

  it('still strips event handlers', () => {
    const input = '<div onload="alert(1)">Test</div>'
    const result = sanitizeHtmlWithEmbeds(input)
    expect(result).not.toContain('onload')
  })

  it('still strips data: URIs', () => {
    const input = '<img src="data:image/svg+xml,<svg></svg>">'
    const result = sanitizeHtmlWithEmbeds(input)
    expect(result).not.toContain('data:')
  })
})
