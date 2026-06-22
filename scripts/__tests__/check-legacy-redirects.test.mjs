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
