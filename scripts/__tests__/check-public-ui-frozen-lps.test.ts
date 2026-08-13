import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  FROZEN_NOINDEX_LPS,
  pageDeclaresNoindex,
  isFrozenNoindexLp,
  frozenNoindexLpFailures,
} from '../lib/frozen-noindex-lps.mjs'

/**
 * Break-tests for the P10 wrap hole: frozen noindex LPs may leave B, and
 * nothing else may hide there.
 */

const ROOT = process.cwd()

describe('frozen noindex LPs (ci:public-ui B exclusion)', () => {
  it('names at least one LP, each with a noindex why', () => {
    expect(FROZEN_NOINDEX_LPS.length).toBeGreaterThan(0)
    for (const row of FROZEN_NOINDEX_LPS) {
      expect(row.file.startsWith('app/lp/')).toBe(true)
      expect(row.file.endsWith('/page.tsx')).toBe(true)
      expect(row.why).toMatch(/noindex/i)
    }
  })

  it('the wrap list is exactly the named Heath LP (growth is a reviewed test change)', () => {
    expect(FROZEN_NOINDEX_LPS.map((r) => r.file)).toEqual(['app/lp/tetherow/heath/page.tsx'])
  })

  it('every listed page exists in this repo and declares robots noindex', () => {
    const failures = frozenNoindexLpFailures(ROOT)
    expect(failures).toEqual([])
    expect(isFrozenNoindexLp('app/lp/tetherow/heath/page.tsx')).toBe(true)
    expect(isFrozenNoindexLp('app/housing-market/reports/page.tsx')).toBe(false)
    expect(isFrozenNoindexLp('app/about/page.tsx')).toBe(false)
  })

  it('pageDeclaresNoindex accepts robots.index=false and rejects an indexable page', () => {
    expect(pageDeclaresNoindex('export const metadata = { robots: { index: false, follow: false } }')).toBe(
      true,
    )
    expect(pageDeclaresNoindex("export const metadata = { robots: { index: true } }")).toBe(false)
    expect(pageDeclaresNoindex("return pageMetadata({ title: 'X', path: '/x', noindex: true })")).toBe(true)
  })

  it('rejects a non-LP path, an indexable LP, a missing why, and a missing file', () => {
    const dir = join(tmpdir(), `rr-frozen-lp-${Date.now()}`)
    mkdirSync(join(dir, 'app/lp/x'), { recursive: true })
    writeFileSync(
      join(dir, 'app/lp/x/page.tsx'),
      'export const metadata = { robots: { index: false } }\nexport default function P(){return null}\n',
    )
    try {
      expect(
        frozenNoindexLpFailures(dir, [
          { file: 'app/about/page.tsx', why: 'noindex hide' },
        ]).some((f) => f.includes('LP page.tsx only')),
      ).toBe(true)

      expect(
        frozenNoindexLpFailures(dir, [
          { file: 'app/lp/x/page.tsx', why: 'frozen conversion surface' },
        ]).some((f) => f.includes('must name noindex')),
      ).toBe(true)

      writeFileSync(
        join(dir, 'app/lp/x/page.tsx'),
        'export const metadata = { robots: { index: true } }\nexport default function P(){return null}\n',
      )
      expect(
        frozenNoindexLpFailures(dir, [
          { file: 'app/lp/x/page.tsx', why: 'E-SYSTEM noindex. Do not restyle.' },
        ]).some((f) => f.includes('indexable')),
      ).toBe(true)

      expect(
        frozenNoindexLpFailures(dir, [
          { file: 'app/lp/missing/page.tsx', why: 'noindex leftover' },
        ]).some((f) => f.includes('does not exist')),
      ).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
