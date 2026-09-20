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
  placeHeroFoldDensityProblems,
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
        '.listing-strip {\n  --listing-strip-h: 2.75rem;\n  --listing-strip-thumb: 2.75rem;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 0;\n  min-height: var(--listing-strip-h);\n  padding: 0;\n  background: var(--v3-navy);\n',
        '.listing-strip {\n  --listing-strip-h: 2.75rem;\n  --listing-strip-thumb: 2.75rem;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 0;\n  min-height: var(--listing-strip-h);\n  padding: 0;\n  background: var(--v3-cream);\n',
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

  it('refuses overlay-compact that keeps the 44px tap band', () => {
    const css = live.breadcrumbCss.replace(
      /min-height:\s*1\.75rem/,
      'min-height: var(--v3-tap)',
    )
    const p = breadcrumbFoldDensityProblems({
      root: REPO,
      files: { ...live, breadcrumbCss: css },
    })
    expect(p.join('\n')).toMatch(/1\.75rem|tap band|overlay-compact/i)
  })

  it('refuses listing H1 faux-bold (weight 500 or missing font-synthesis: none)', () => {
    const css = live.listingCss.replace(
      /h1\.listing-ask \{[\s\S]*?\}/,
      `h1.listing-ask {
  font-family: var(--v3-font-display);
  font-size: var(--v3-size-display-1);
  font-weight: var(--v3-weight-medium);
  font-synthesis: weight style small-caps;
  line-height: var(--v3-leading-heading);
}`,
    )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: css },
    })
    expect(p.join('\n')).toMatch(/font-weight 400|font-synthesis: none|faux-bold|Amboqia/i)
  })

  it('refuses cream under the gallery and a button row between price and beds', () => {
    const css = live.listingCss
      .replace(
        '.listing-face {\n    gap: var(--v3-space-3xs);\n    padding-top: 0;',
        '.listing-face {\n    gap: var(--v3-space-xs);\n    padding-top: var(--v3-space-2xs);',
      )
      .replace(
        '.listing-detail-shell {\n    padding-top: 0;',
        '.listing-detail-shell {\n    padding-top: var(--v3-space-xs);',
      )
      .replace(
        '.listing-detail-main > .listing-hero-column {\n    padding-top: 0;\n    padding-bottom: 0;',
        '.listing-detail-main > .listing-hero-column {\n    padding-top: var(--v3-space-md);\n    padding-bottom: var(--v3-space-md);',
      )
      .replace(
        '.listing-detail-main > .listing-hero-column + .listing-face {\n    margin-top: calc(-1 * var(--v3-space-md));',
        '.listing-detail-main > .listing-hero-column + .listing-face {\n    margin-top: var(--v3-space-md);',
      )
    const page = live.page
    const strip = readFileSync(join(REPO, 'components/site/listing-detail/PriceCtaStrip.tsx'), 'utf8').replace(
      'listing-face__title',
      'listing-face__stack',
    )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: css, priceCta: strip, page },
    })
    expect(p.join('\n')).toMatch(/flush|cream under the gallery|title stack|price-row|3xs/i)
  })

  it('refuses a phone fold that puts display-1 air back on the address', () => {
    const css = live.listingCss
      .replace(
        '.listing-ask {\n    font-size: var(--v3-size-display-2);',
        '.listing-ask {\n    font-size: var(--v3-size-display-1);',
      )
      .replace(
        '.listing-frame__tabs {\n    left: var(--v3-space-2xs);\n    bottom: 0;',
        '.listing-frame__tabs {\n    left: var(--v3-space-2xs);\n    bottom: var(--v3-space-sm);',
      )
    const p = listingHeroFoldDensityProblems({
      root: REPO,
      files: { ...live, listingCss: css },
    })
    expect(p.join('\n')).toMatch(/display-2|flush on the strip|listing-ask|Photos\/Map/i)
  })

  it('refuses overlay-compact list overflow that clips Avenue at 375', () => {
    const css = live.breadcrumbCss.replace(
      '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__list {\n  overflow: visible;',
      '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__list {\n  overflow-x: auto;',
    )
    const p = breadcrumbFoldDensityProblems({
      root: REPO,
      files: { ...live, breadcrumbCss: css },
    })
    expect(p.join('\n')).toMatch(/overflow:visible|overflow-x|clip|Avenue/i)
  })

  it('refuses an overlay crumb that ellipsizes the address at 375', () => {
    const css = live.breadcrumbCss
      .replace(
        '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__text--current {\n  max-width: none;',
        '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__text--current {\n  max-width: min(18rem, 52vw);',
      )
      .replace(
        '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__item:last-child {\n  flex: 0 0 auto;',
        '.v3.v3-breadcrumb--overlay-compact .v3-breadcrumb__item:last-child {\n  flex: 0 1 auto;',
      )
    const p = breadcrumbFoldDensityProblems({
      root: REPO,
      files: { ...live, breadcrumbCss: css },
    })
    expect(p.join('\n')).toMatch(/ellipsis|52vw|shrink|828 Florida|clip/i)
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

  it('passes the live place templates', () => {
    expect(placeHeroFoldDensityProblems({ root: REPO })).toEqual([])
  })

  it('refuses a place crumb that is not overlay', () => {
    const cityPage = readFileSync(join(REPO, 'app/cities/[slug]/page.tsx'), 'utf8').replace(
      'overlay={Boolean(stagePosterSrc)}',
      '',
    )
    const p = placeHeroFoldDensityProblems({
      root: REPO,
      files: { 'app/cities/[slug]/page.tsx': cityPage },
    })
    expect(p.join('\n')).toMatch(/overlay/)
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
