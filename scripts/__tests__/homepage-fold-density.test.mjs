import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homepageFoldDensityProblems } from '../lib/homepage-fold-density.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  railsCss: readFileSync(join(REPO, 'app/_v3/home-homes-rails.css'), 'utf8'),
  answersCss: readFileSync(join(REPO, 'components/site/v3/V3Answers.css'), 'utf8'),
  page: readFileSync(join(REPO, 'app/page.tsx'), 'utf8'),
  layout: readFileSync(join(REPO, 'app/layout.tsx'), 'utf8'),
}

describe('homepage fold density (SITE-125 photo peek)', () => {
  it('passes the live tree', () => {
    expect(homepageFoldDensityProblems({ root: REPO })).toEqual([])
  })

  it('refuses wrapper xl / first-child sm that leaves photos under the fold', () => {
    const railsCss = live.railsCss
      .replace('.home-rails {\n  padding-top: 0;\n}', '.home-rails {\n  padding-top: var(--v3-space-xl);\n}')
      .replace(
        '.home-rails > .home-rail:first-child {\n  padding-top: var(--v3-space-2xs);\n}',
        '.home-rails > .home-rail:first-child {\n  padding-top: var(--v3-space-sm);\n}',
      )
    const p = homepageFoldDensityProblems({
      root: REPO,
      files: { ...live, railsCss },
    })
    expect(p.join('\n')).toMatch(/photos-below|heading-only|photographs under the 900 fold|tall quiet/i)
  })

  it('refuses heading-in-fold when first-rail head pad grows back to sm', () => {
    const railsCss = live.railsCss.replace(
      '.home-rails > .home-rail:first-child .home-rail__head {\n  padding-bottom: var(--v3-space-2xs);\n}',
      '.home-rails > .home-rail:first-child .home-rail__head {\n  padding-bottom: var(--v3-space-sm);\n}',
    )
    const p = homepageFoldDensityProblems({
      root: REPO,
      files: { ...live, railsCss },
    })
    expect(p.join('\n')).toMatch(/photos-below|padding-bottom must be/i)
  })

  it('refuses restoring the 22rem door stack or sticky Call/Text', () => {
    const answersCss = live.answersCss.replace(
      'grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(15rem, 1.1fr);',
      'grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);',
    )
    const page = `${live.page}\n<V3PhoneDock />`
    const p = homepageFoldDensityProblems({
      root: REPO,
      files: { ...live, answersCss, page },
    })
    expect(p.join('\n')).toMatch(/22rem|V3PhoneDock/)
  })

  it('ci:aeo-hub-guides exits 0 on HEAD', () => {
    const r = spawnSync('node', [join(REPO, 'scripts/check-aeo-hub-guides.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/First house-rail photos must peek/)
  })
})
