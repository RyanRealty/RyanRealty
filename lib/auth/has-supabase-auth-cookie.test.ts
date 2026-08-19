import { describe, expect, it } from 'vitest'
import { hasSupabaseAuthCookie } from './has-supabase-auth-cookie'

describe('hasSupabaseAuthCookie', () => {
  it('is false with no cookies', () => {
    expect(hasSupabaseAuthCookie([])).toBe(false)
  })

  it('is false for visitor cookies only', () => {
    expect(hasSupabaseAuthCookie([{ name: 'rr_vid' }])).toBe(false)
  })

  it('is true for the Supabase SSR auth cookie', () => {
    expect(
      hasSupabaseAuthCookie([{ name: 'sb-dwvlophlbvvygjfxcrhm-auth-token' }]),
    ).toBe(true)
  })

  it('is true for a chunked auth cookie', () => {
    expect(
      hasSupabaseAuthCookie([{ name: 'sb-dwvlophlbvvygjfxcrhm-auth-token.0' }]),
    ).toBe(true)
  })
})
