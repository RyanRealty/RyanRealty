import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  FOLD_LOCK,
  LISTING_FOLD_DENSITY_GATE,
  breadcrumbFoldDensityProblems,
  listingFoldDensityProblems,
  listingHeroFoldDensityProblems,
} from '../lib/listing-fold-density.mjs'
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  breadcrumbTsx: readFileSync(join(REPO, 'components/site/v3/V3Breadcrumb.tsx'), 'utf8'),
  breadcrumbCss: readFileSync(join(REPO, 'components/site/v3/V3Breadcrumb.css'), 'utf8'),
  collapse: readFileSync(join(REPO, 'components/site/v3/V3BreadcrumbCollapse.client.tsx'), 'utf8'),
  page: readFileSync(join(REPO, 'app/listing/[listingKey]/page.tsx'), 'utf8'),
  listingCss: readFileSync(join(REPO, 'components/site/listing-detail/listing-detail.css'), 'utf8'),
  parity: readFileSync(join(REPO, 'design_system/ryan-realty/ui_kits/listing-detail/parity.json'), 'utf8'),
}

describe('listing-fold-density lock', () => {
  it('passes the live tree', () => {
    expect(listingFoldDensityProblems({ root: REPO })).toEqual([])
    expect(breadcrumbFoldDensityProblems({ root: REPO })).toEqual([])
    expect(listingHeroFoldDensityProblems({ root: REPO })).toEqual([])
  })

  it('refuses a tall below-nav crumb and a wrapping trail', () => {
    const css = live.breadcrumbCss
      .replace('padding-top: var(--v3-space-2xs);', 'padding-top: var(--v3-space-md);')
      .replace('flex-wrap: nowrap;', 'flex-wrap: wrap;')
    const p = breadcrumbFoldDensityProblems({
      root: REPO,
      files: { ...live, breadcrumbCss: css },
    })
    expect(p.join('\n')).toMatch(/tall quiet|nowrap|oversized crumb|below-nav/i)
  })

  it('refuses a short mosaic well and a cream filmstrip', () => {
    const css = live.listingCss
      .replace(
        '--v3-mosaic-h: min(calc(100dvh - var(--v3-chrome-h) - 2.75rem), 50rem);',
        '--v3-mosaic-h: 28.75rem;',
      )
      .replace(
        '.listing-strip {\n  --listing-strip-h: 2.75rem;\n  --listing-strip-thumb: 2.75rem;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 2px;\n  min-height: var(--listing-strip-h);\n  padding: 0;\n  background: var(--v3-navy);\n',
        '.listing-strip {\n  --listing-strip-h: 2.75rem;\n  --listing-strip-thumb: 2.75rem;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 2px;\n  min-height: var(--listing-strip-h);\n  padding: 0;\n  background: var(--v3-cream);\n',
      )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: css },
    })
    expect(p.join('\n')).toMatch(/viewport|filmstrip|navy/i)
  })

  it('refuses cream mosaic well and oversized thumbs', () => {
    const css = live.listingCss
      .replace('.listing-mosaic {\n  position: relative;\n  width: 100%;\n  background: var(--v3-navy);\n}', '.listing-mosaic {\n  position: relative;\n  width: 100%;\n  background: var(--v3-cream);\n}')
      .replace('--listing-strip-thumb: 2.75rem;', '--listing-strip-thumb: 5rem;')
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: css },
    })
    expect(p.join('\n')).toMatch(/navy|cream bloat|thumbs/i)
  })

  it('refuses a listing crumb that is not overlay', () => {
    const page = live.page.replace(
      '<V3Breadcrumb trail={breadcrumbs} tone="on-media" overlay />',
      '<V3Breadcrumb trail={breadcrumbs} />',
    )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, page },
    })
    expect(p.join('\n')).toMatch(/overlay/)
  })

  it('Tip Ready tasteDoneProblems refuses listing-detail fold bloat', () => {
    const bloatedCss = live.listingCss.replace(
      /--listing-strip-thumb:\s*2\.75rem/,
      '--listing-strip-thumb: 5rem',
    )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: bloatedCss },
    })
    expect(p.join('\n')).toMatch(/thumb|cream bloat/i)
    const liveFold = listingFoldDensityProblems({ root: REPO }).filter((line) =>
      /crumb|mosaic|thumb|foldDensity|tall quiet|cream bloat/i.test(line),
    )
    expect(liveFold).toEqual([])
  })

  it('ci:listing-fold-density exits 0 on HEAD', () => {
    const r = spawnSync('node', [join(REPO, 'scripts/check-listing-fold-density.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(LISTING_FOLD_DENSITY_GATE)
    expect(FOLD_LOCK.gate).toBe(LISTING_FOLD_DENSITY_GATE)
  })
})
