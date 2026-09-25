import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homepageFoldDensityProblems } from '../lib/homepage-fold-density.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  shelvesCss: readFileSync(join(REPO, 'app/_v3/home-shelves.css'), 'utf8'),
  shelves: readFileSync(join(REPO, 'app/_v3/HomeHomesRails.tsx'), 'utf8'),
  answersCss: readFileSync(join(REPO, 'components/site/v3/V3Answers.css'), 'utf8'),
  page: readFileSync(join(REPO, 'app/page.tsx'), 'utf8'),
  layout: readFileSync(join(REPO, 'app/layout.tsx'), 'utf8'),
}

describe('homepage fold density (SITE-125 photo peek)', () => {
  it('passes the live tree', () => {
    expect(homepageFoldDensityProblems({ root: REPO })).toEqual([])
  })

  it('refuses a tall quiet over the shelves that leaves photos under the fold', () => {
    const shelvesCss = live.shelvesCss.replace(
      'padding: var(--v3-space-md) var(--v3-gutter) var(--v3-space-xl);',
      'padding: var(--v3-space-xl) var(--v3-gutter) var(--v3-space-xl);',
    )
    expect(shelvesCss).not.toBe(live.shelvesCss)
    const p = homepageFoldDensityProblems({
      root: REPO,
      files: { ...live, shelvesCss },
    })
    expect(p.join('\n')).toMatch(/padding-top must stay 0, 2xs, sm or md/)
  })

  it('refuses shelves that are not listing dials (Matt 2026-09-24)', () => {
    const shelves = live.shelves.replace(/<V3ListingDial\w*/g, '<HomeListingRail')
    const p = homepageFoldDensityProblems({
      root: REPO,
      files: { ...live, shelves },
    })
    expect(p.join('\n')).toMatch(/must be a V3ListingDial/)
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
