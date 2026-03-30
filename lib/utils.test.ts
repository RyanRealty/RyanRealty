import { describe, it, expect } from 'vitest'
import { cn, sanitizeBreadcrumbLabel } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active')).toBe('base active')
    expect(cn('base', false && 'active')).toBe('base')
  })

  it('deduplicates Tailwind classes', () => {
    // twMerge should pick the last conflicting class
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })
})

describe('sanitizeBreadcrumbLabel', () => {
  it('returns empty string for null', () => {
    expect(sanitizeBreadcrumbLabel(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(sanitizeBreadcrumbLabel(undefined)).toBe('')
  })

  it('returns empty string for non-string', () => {
    expect(sanitizeBreadcrumbLabel(123 as unknown as string)).toBe('')
  })

  it('decodes numeric HTML entities', () => {
    expect(sanitizeBreadcrumbLabel('It&#39;s great')).toBe("It's great")
  })

  it('decodes hex HTML entities', () => {
    expect(sanitizeBreadcrumbLabel('&#x26; more')).toBe('& more')
  })

  it('decodes named HTML entities', () => {
    expect(sanitizeBreadcrumbLabel('A &amp; B')).toBe('A & B')
    expect(sanitizeBreadcrumbLabel('&lt;tag&gt;')).toBe('<tag>')
    expect(sanitizeBreadcrumbLabel('&quot;quoted&quot;')).toBe('"quoted"')
    expect(sanitizeBreadcrumbLabel('&#39;apos&#39;')).toBe("'apos'")
    expect(sanitizeBreadcrumbLabel('&apos;apos&apos;')).toBe("'apos'")
  })

  it('normalizes whitespace', () => {
    expect(sanitizeBreadcrumbLabel('  hello   world  ')).toBe('hello world')
  })

  it('handles multiple entities in one string', () => {
    expect(sanitizeBreadcrumbLabel('A &amp; B &lt; C')).toBe('A & B < C')
  })

  it('passes through clean strings unchanged', () => {
    expect(sanitizeBreadcrumbLabel('Hello World')).toBe('Hello World')
  })
})
