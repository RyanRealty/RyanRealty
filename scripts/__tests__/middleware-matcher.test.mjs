import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { middlewareMatcherEntries, middlewareMatcherNames } from '../lib/middleware-matcher.mjs'

const FIRST = "'/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\\\..*).*)'"

const shape = (entries) => `export const config = {\n  matcher: [\n    ${entries.join(',\n    ')},\n  ],\n}\n`

describe('middlewareMatcherEntries: the entries of config.matcher, wherever /_next/image sits', () => {
  it('reads the live middleware.ts and finds /_next/image as its own entry', () => {
    const src = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')
    expect(middlewareMatcherNames(src, '/_next/image')).toBe(true)
  })

  it('passes with /_next/image last (the old shape) and in the middle (after PR #391)', () => {
    expect(middlewareMatcherNames(shape([FIRST, "'/_next/image'"]), '/_next/image')).toBe(true)
    const withEdition = `export const config = {\n  matcher: [\n    ${FIRST},\n    '/_next/image',\n    // The first pattern skips any path with a dot (/2099-01.html) [sic]\n    '/housing-market/reports/monthly/:month',\n  ],\n}\n`
    expect(middlewareMatcherEntries(withEdition)).toEqual([
      "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\\\..*).*)",
      '/_next/image',
      '/housing-market/reports/monthly/:month',
    ])
    expect(middlewareMatcherNames(withEdition, '/_next/image')).toBe(true)
  })

  it('fails when the path only appears inside the first pattern', () => {
    expect(middlewareMatcherNames(shape([FIRST]), '/_next/image')).toBe(false)
  })

  it('fails when the entry is commented out, by line or by block', () => {
    expect(middlewareMatcherNames(shape([FIRST, "// '/_next/image'"]), '/_next/image')).toBe(false)
    expect(middlewareMatcherNames(shape([FIRST, "/* '/_next/image' */ '/other'"]), '/_next/image')).toBe(false)
  })

  it('returns nothing when there is no matcher', () => {
    expect(middlewareMatcherEntries('export const config = {}')).toEqual([])
  })
})
