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
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousSupabaseAnon
    }
  })
})
