import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './safeRedirect'

describe('safeRedirectPath (audit p0.2 — no open redirect)', () => {
  it('keeps normal same-origin paths (with query + hash)', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard')
    expect(safeRedirectPath('/admin/people?stage=hot#x')).toBe('/admin/people?stage=hot#x')
    expect(safeRedirectPath('/a//b')).toBe('/a//b') // inner double-slash is harmless
  })

  it('neutralizes protocol-relative open redirects', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/evil.com')
    expect(safeRedirectPath('///evil.com')).toBe('/evil.com')
    expect(safeRedirectPath('  //evil.com')).toBe('/evil.com')
  })

  it('neutralizes backslash authority tricks', () => {
    expect(safeRedirectPath('/\\evil.com')).toBe('/evil.com')
    expect(safeRedirectPath('\\\\evil.com')).toBe('/evil.com')
  })

  it('rejects absolute URLs and dangerous schemes → fallback', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(safeRedirectPath('mailto:x@y.com')).toBe('/')
    expect(safeRedirectPath('evil.com/path')).toBe('/')
  })

  it('relativizes a bare path and applies the fallback', () => {
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
    expect(safeRedirectPath(undefined, '/dashboard/settings')).toBe('/dashboard/settings')
  })

  it('strips CR/LF control chars', () => {
    expect(safeRedirectPath('/ok\r\n/evil')).toBe('/ok/evil')
  })
})
