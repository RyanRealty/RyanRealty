import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { normalize, structuralProblems, uncoveredPaths } from '../check-legacy-redirects.mjs'

describe('normalize', () => {
  it('lowercases, strips a trailing slash, decodes', () => {
    expect(normalize('/About-Ryan-Realty/')).toBe('/about-ryan-realty')
    expect(normalize('/a%20b')).toBe('/a b')
    expect(normalize('/')).toBe('/')
  })
})

describe('structuralProblems', () => {
  it('passes a clean single-hop map', () => {
    expect(structuralProblems({ '/old': '/new', '/old2': '/new2' })).toHaveLength(0)
  })

  it('FLAGS a non-absolute destination', () => {
    const p = structuralProblems({ '/old': 'new' })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/not an absolute path/)
  })

  it('FLAGS a multi-hop chain (destination is itself a key)', () => {
    const p = structuralProblems({ '/a': '/b', '/b': '/c' })
    expect(p.some((m) => /multi-hop/.test(m))).toBe(true)
  })

  it('allows a self-map (key maps to itself, not a hop)', () => {
    expect(structuralProblems({ '/x': '/x' })).toHaveLength(0)
  })
})

describe('uncoveredPaths', () => {
  it('returns paths with no key in the map (normalized)', () => {
    const map = { '/covered': '/new' }
    expect(uncoveredPaths(map, ['/covered', '/missing'])).toEqual(['/missing'])
  })

  it('matches case- and trailing-slash-insensitively', () => {
    const map = { '/about-ryan-realty': '/about' }
    expect(uncoveredPaths(map, ['/About-Ryan-Realty/'])).toHaveLength(0)
  })

  it('ignores the root path', () => {
    expect(uncoveredPaths({}, ['/'])).toHaveLength(0)
  })
})

describe('SITE-180 Tetherow blog slug hop', () => {
  const map = JSON.parse(readFileSync(new URL('../../data/legacy-redirects.json', import.meta.url), 'utf8'))
  const nextConfig = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8')

  it('hops the live /blog slug onto the community page, not a streamed 200', () => {
    expect(map['/blog/tetherow-resort-living-real-estate']).toBe('/communities/tetherow')
    expect(map['/tetherow-resort-living-real-estate']).toBe('/communities/tetherow')
    expect(nextConfig).toMatch(/source:\s*'\/blog\/tetherow-resort-living-real-estate'/)
    expect(nextConfig).toMatch(
      /source:\s*'\/blog\/tetherow-resort-living-real-estate',\s*destination:\s*'\/communities\/tetherow',\s*permanent:\s*true/,
    )
  })

  it('leaves the other named community guides as live /blog URLs', () => {
    for (const slug of [
      'caldera-springs-buyers-guide',
      'eagle-crest-affordable-resort-redmond',
      'sunriver-year-round-living-vs-vacation',
    ]) {
      expect(map[`/blog/${slug}`]).toBeUndefined()
      expect(map[`/${slug}`]).toBe(`/blog/${slug}`)
    }
  })
})
