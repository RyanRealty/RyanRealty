import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  chromeHrefProblems,
  legacyRedirectSources,
  literalHrefs,
  redirectSourcesFromNextConfig,
  sourceToRegExp,
} from '../check-chrome-links.mjs'

/**
 * Break-tests for ci:chrome-links (UXLIVE-4 / UXLIVE-8, visibility audit
 * 2026-09-22). Each rule is shown to FIRE on the exact hrefs the chrome shipped
 * before the fix, and to stay quiet on the clean paths that replaced them.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')

const CONFIG = `
const nextConfig = {
  async redirects() {
    return [
      { source: '/luxury-homes-bend', destination: '/homes-for-sale/bend/luxury', permanent: true },
      { source: '/buy', destination: '/homes-for-sale', permanent: true },
      { source: '/areas/:slug', destination: '/homes-for-sale', permanent: true },
      { source: '/properties/:path*', destination: '/homes-for-sale', permanent: true },
      { source: '/:year(2023)/:path*', destination: '/blog', permanent: true },
      { source: '/sold', destination: '/homes-for-sale?status=Sold', permanent: false },
      { source: '/blog', has: [{ type: 'query', key: 'page', value: '(?<page>\\\\d+)' }], destination: '/blog/page/:page', permanent: true },
    ]
  },
  async rewrites() {
    return [{ source: '/homes-for-sale', destination: '/search' }]
  },
}
`

describe('redirectSourcesFromNextConfig', () => {
  const sources = redirectSourcesFromNextConfig(CONFIG)

  it('reads every unconditional redirect, 308 and 307 alike', () => {
    expect(sources).toEqual([
      '/luxury-homes-bend',
      '/buy',
      '/areas/:slug',
      '/properties/:path*',
      '/:year(2023)/:path*',
      '/sold',
    ])
  })

  it('skips conditional rules and rewrites', () => {
    expect(sources).not.toContain('/blog')
    expect(sources).not.toContain('/homes-for-sale')
  })

  it('parses the real next.config.ts and finds the UXLIVE-8 hops', () => {
    const real = redirectSourcesFromNextConfig(readFileSync(resolve(REPO, 'next.config.ts'), 'utf8'))
    expect(real).toContain('/luxury-homes-bend')
    expect(real).toContain('/buy')
    expect(real).toContain('/activity')
    expect(real).not.toContain('/homes-for-sale')
  })
})

describe('sourceToRegExp', () => {
  it('matches literal, :param, :param* and :param(regex) shapes', () => {
    expect(sourceToRegExp('/buy').test('/buy')).toBe(true)
    expect(sourceToRegExp('/buy').test('/buy/')).toBe(true)
    expect(sourceToRegExp('/buy').test('/buyers')).toBe(false)
    expect(sourceToRegExp('/buy').test('/buy/relocation')).toBe(false)
    expect(sourceToRegExp('/areas/:slug').test('/areas/bend')).toBe(true)
    expect(sourceToRegExp('/areas/:slug').test('/areas/bend/x')).toBe(false)
    expect(sourceToRegExp('/properties/:path*').test('/properties')).toBe(true)
    expect(sourceToRegExp('/properties/:path*').test('/properties/a/b')).toBe(true)
    expect(sourceToRegExp('/:year(2023)/:path*').test('/2023/05/post')).toBe(true)
    expect(sourceToRegExp('/:year(2023)/:path*').test('/2026/05/post')).toBe(false)
  })
})

describe('legacyRedirectSources', () => {
  it('keeps real redirects and drops identity rows, normalized', () => {
    const set = legacyRedirectSources({
      '/luxury-homes-bend-oregon': '/homes-for-sale/bend/luxury',
      '/contact': '/contact',
      '/About-Us/': '/about',
    })
    expect(set.has('/luxury-homes-bend-oregon')).toBe(true)
    expect(set.has('/contact')).toBe(false)
    expect(set.has('/about-us')).toBe(true)
  })
})

describe('chromeHrefProblems', () => {
  const ctx = {
    redirectSources: redirectSourcesFromNextConfig(CONFIG),
    legacySources: legacyRedirectSources({ '/luxury-homes-bend-oregon': '/homes-for-sale/bend/luxury' }),
  }

  it('FIRES on the hrefs the chrome shipped before the fix', () => {
    const before = [
      { href: '/homes-for-sale?view=list', where: 'Homes' },
      { href: '/homes-for-sale?view=map', where: 'Map search' },
      { href: '/luxury-homes-bend', where: 'Luxury homes in Bend' },
      { href: '/buy', where: 'Buy' },
      { href: '/luxury-homes-bend-oregon', where: 'legacy' },
      { href: '/areas/bend/', where: 'trailing slash' },
    ]
    const problems = chromeHrefProblems(before, ctx)
    expect(problems.filter((p) => p.includes('?view= is a noindex variant'))).toHaveLength(2)
    expect(problems.some((p) => p.startsWith('Luxury homes in Bend:') && p.includes('redirect source'))).toBe(true)
    expect(problems.some((p) => p.startsWith('Buy:'))).toBe(true)
    expect(problems.some((p) => p.startsWith('legacy:') && p.includes('legacy-redirects.json'))).toBe(true)
    expect(problems.some((p) => p.startsWith('trailing slash:'))).toBe(true)
  })

  it('flags any query, not only view', () => {
    expect(chromeHrefProblems([{ href: '/homes-for-sale?status=Sold', where: 'Sold' }], ctx)).toHaveLength(1)
  })

  it('stays quiet on clean paths, fragments and non-page hrefs', () => {
    const after = [
      { href: '/homes-for-sale', where: 'Homes' },
      { href: '/homes-for-sale/bend/luxury', where: 'Luxury' },
      { href: '/sell#get-value', where: 'Value my home' },
      { href: '/', where: 'wordmark' },
      { href: 'tel:+15417033095', where: 'phone' },
      { href: 'https://www.instagram.com/ryanrealtybend', where: 'social' },
      { href: '//cdn.example.com/x', where: 'protocol-relative' },
      { href: '/buy/relocation', where: 'intent page' },
    ]
    expect(chromeHrefProblems(after, ctx)).toEqual([])
  })
})

describe('literalHrefs', () => {
  it('reads JSX and object-literal hrefs, skipping template interpolation', () => {
    const src = `<Link href="/" /> <a href={'/about'} /> const x = { href: '/team' } <a href={\`tel:\${n}\`} /> <a href={\`/x/\${slug}\`} />`
    expect(literalHrefs(src, 'f').map((l) => l.href)).toEqual(['/', '/about', '/team'])
  })
})

describe('the real repo', () => {
  it('passes on the current chrome', () => {
    const out = execFileSync(process.execPath, [resolve(REPO, 'scripts/check-chrome-links.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(out).toMatch(/✓ chrome-links: \d+ chrome hrefs/)
  })
})
