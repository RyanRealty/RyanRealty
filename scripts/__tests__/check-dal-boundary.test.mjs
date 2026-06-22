import { describe, it, expect } from 'vitest'
import { scanCachedWrites } from '../check-dal-boundary.mjs'

// Regression suite for the cached-read write classifier in check-dal-boundary.mjs
// (Part A: inline callbacks + cache infra; Part C: named fetch-fn references).
// scanCachedWrites(relPath, content) returns [{ file, line, rule, detail }].

const P = 'lib/data/x/sample.ts' // a normal DAL file (not under lib/data/cache/)

describe('Part C — named fetch-fn reference resolution', () => {
  it('FIRES on a write inside a same-file named fetch fn (makeResilientCached)', () => {
    const src = `
import { makeResilientCached } from '@/lib/data/cache/resilient'
async function fetchBad(id) {
  const sb = await mk()
  await sb.from('x').insert({ id })
  return null
}
export const getBad = makeResilientCached(fetchBad, ['k'], { revalidate: 60, tags: [] }, null)
`
    const v = scanCachedWrites(P, src)
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('write-in-named-cache-fn')
    expect(v[0].detail).toContain('fetchBad')
  })

  it('FIRES on a write inside a same-file named fetch fn (unstable_cache, const arrow)', () => {
    const src = `
import { unstable_cache } from 'next/cache'
const fetchBad = async (id) => {
  const sb = await mk()
  await sb.from('x').update({ seen: true }).eq('id', id)
  return null
}
export const getBad = unstable_cache(fetchBad, ['k'], { revalidate: 60 })
`
    const v = scanCachedWrites(P, src)
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('write-in-named-cache-fn')
  })

  it('does NOT fire on a clean read inside a named fetch fn', () => {
    const src = `
import { unstable_cache } from 'next/cache'
async function fetchGood() {
  const sb = await mk()
  const { data } = await sb.from('x').select('*')
  return data
}
export const getGood = unstable_cache(fetchGood, ['k'], { revalidate: 60 })
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })

  it('does NOT fire on a write in a SIBLING uncached fn (scopes to the referenced fn only)', () => {
    const src = `
import { unstable_cache } from 'next/cache'
async function fetchGood() { const sb = await mk(); return (await sb.from('x').select('*')).data }
export const getGood = unstable_cache(fetchGood, ['k'], { revalidate: 60 })
export async function saveThing(id) {
  const sb = await mk()
  await sb.from('x').update({ seen: true }).eq('id', id)
}
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })

  it('does NOT fire on an UNRESOLVED cross-file / imported reference', () => {
    const src = `
import { importedFetch } from './other'
import { makeResilientCached } from '@/lib/data/cache/resilient'
export const getX = makeResilientCached(importedFetch, ['k'], { revalidate: 60 }, null)
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })

  it('does NOT fire when the reference is a function PARAMETER (the resilient.ts wrapper case)', () => {
    const src = `
import { unstable_cache } from 'next/cache'
export function makeResilientCached(fetchFn, keyParts, opts, fallback) {
  const cached = unstable_cache(fetchFn, keyParts, opts)
  return cached
}
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })

  it('does NOT mistake a factory call someFactory(...) for a named reference', () => {
    const src = `
import { unstable_cache } from 'next/cache'
async function fetchGood() { const sb = await mk(); return (await sb.from('x').select('*')).data }
export const getGood = unstable_cache(fetchGood, ['k'], { revalidate: 60 })
const helper = makeOpts({ revalidate: 60 })
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })
})

describe('Part A — inline callbacks + cache infrastructure (regression)', () => {
  it('FIRES on a write inside an inline unstable_cache callback', () => {
    const src = `
import { unstable_cache } from 'next/cache'
export const getY = unstable_cache(
  async () => { const sb = await mk(); await sb.from('x').delete().eq('id', 1); return null },
  ['k'],
  { revalidate: 60 },
)
`
    const v = scanCachedWrites(P, src)
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('write-in-cache-callback')
  })

  it('does NOT fire on a clean read inside an inline callback (template-literal decoy)', () => {
    const src = `
import { unstable_cache } from 'next/cache'
export const getZ = unstable_cache(
  async (id) => { const sb = await mk(); const key = \`row \${id} )\`; return (await sb.from('x').select('*').eq('id', id)).data },
  ['k'],
  { revalidate: 60 },
)
`
    expect(scanCachedWrites(P, src)).toHaveLength(0)
  })

  it('FIRES on any write in lib/data/cache/ (read-only infrastructure)', () => {
    const src = `export async function bad(sb) { await sb.from('x').insert({}) }`
    const v = scanCachedWrites('lib/data/cache/bad.ts', src)
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('cache-infra-write')
  })
})
