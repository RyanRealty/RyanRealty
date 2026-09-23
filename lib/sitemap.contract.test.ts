import { describe, expect, it } from 'vitest'
import sitemap from '../app/sitemap'

describe('sitemap canonical contract', () => {
  it('emits canonical static URLs and excludes legacy paths', async () => {
    const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const previousSupabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

    try {
      const entries = await sitemap()
      const urls = entries.map((entry) => entry.url)

      expect(urls).toContain('https://example.com/homes-for-sale')
      expect(urls).toContain('https://example.com/team')
      expect(urls).toContain('https://example.com/sell/valuation')

      expect(urls.some((url) => /\/listings(\/|$)/.test(url))).toBe(false)
      expect(urls.some((url) => /\/agents(\/|$)/.test(url))).toBe(false)
      expect(urls.some((url) => /\/home-valuation(\/|$)/.test(url))).toBe(false)
      // Visibility audit 2026-09-22: never submit a redirect source. /luxury-homes-bend
      // 308s to a noindexed query URL (next.config.ts / data/legacy-redirects.json).
      expect(urls).not.toContain('https://example.com/luxury-homes-bend')
      // Every URL exactly once (the static seed and the city loop used to overlap).
      expect(new Set(urls).size).toBe(urls.length)
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousSupabaseAnon
    }
  })
})
