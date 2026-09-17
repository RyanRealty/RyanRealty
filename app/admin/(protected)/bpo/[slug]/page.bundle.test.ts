import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(process.cwd())

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

function valueImportsFrom(source: string, moduleId: string): string[] {
  const re = new RegExp(
    String.raw`^import\s+(?!type\b)[^;]*from\s+['"]${moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
    'gm',
  )
  return source.match(re) ?? []
}

describe('admin/bpo/[slug] serverless graph', () => {
  it('does not import the DAL barrel (bookingAvailability → googleapis ~196mb)', () => {
    const files = [
      'app/admin/(protected)/bpo/[slug]/page.tsx',
      'app/admin/(protected)/bpo/new/page.tsx',
      'app/actions/bpo-admin.ts',
      'lib/bpo/build.ts',
      'lib/bpo/engine.ts',
      'lib/cma/subject.ts',
      'lib/cma/versions.ts',
      'lib/cma/comps.ts',
      'lib/cma/map.ts',
    ]
    for (const file of files) {
      expect(valueImportsFrom(src(file), '@/lib/data'), file).toEqual([])
    }
  })

  it('imports admin v2 leaves instead of the AChart barrel', () => {
    const files = [
      'app/admin/(protected)/bpo/[slug]/page.tsx',
      'app/admin/(protected)/bpo/_components/BpoReviewActions.tsx',
    ]
    for (const file of files) {
      expect(valueImportsFrom(src(file), '@/components/admin/v2'), file).toEqual([])
    }
  })

  it('does not statically import the BPO/CMA build graph from the review actions file', () => {
    const admin = src('app/actions/bpo-admin.ts')
    expect(valueImportsFrom(admin, '@/lib/bpo/build')).toEqual([])
    expect(valueImportsFrom(admin, '@/lib/cma/subject')).toEqual([])
    expect(valueImportsFrom(admin, '@/lib/cma/versions')).toEqual([])
    expect(admin).toMatch(/await import\('@\/lib\/bpo\/build'\)/)
  })
})
