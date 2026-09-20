import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dogFloaterProblems, DOG_FLOATER_GATE } from '../lib/dog-floater.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  floater: readFileSync(join(REPO, 'components/site/v3/V3DogFloater.client.tsx'), 'utf8'),
  css: readFileSync(join(REPO, 'components/site/v3/V3DogFloater.css'), 'utf8'),
  barrel: readFileSync(join(REPO, 'components/site/v3/index.ts'), 'utf8'),
  layout: readFileSync(join(REPO, 'app/layout.tsx'), 'utf8'),
  chrome: readFileSync(join(REPO, 'components/site/v3/V3Chrome.tsx'), 'utf8'),
  dock: readFileSync(join(REPO, 'components/site/v3/V3PhoneDock.client.tsx'), 'utf8'),
  stickyCss: readFileSync(join(REPO, 'components/site/v3/V3StickyAsk.css'), 'utf8'),
  listingPage: readFileSync(join(REPO, 'app/listing/[listingKey]/page.tsx'), 'utf8'),
}

describe('ci:dog-floater lock', () => {
  it('passes the live tree', () => {
    expect(dogFloaterProblems({ root: REPO })).toEqual([])
  })

  it('refuses a layout that drops the floater', () => {
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, layout: live.layout.replace('<V3DogFloater />', '') },
    })
    expect(p.join('\n')).toMatch(/V3DogFloater/)
  })

  it('refuses remounting the sticky phone dock', () => {
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, layout: live.layout.replace('<V3DogFloater />', '<V3PhoneDock />\n          <V3DogFloater />') },
    })
    expect(p.join('\n')).toMatch(/V3PhoneDock|sticky/)
  })

  it('refuses a menu that drops Text us or invents a number', () => {
    const floater = live.floater
      .replace('Text us', 'Call now')
      .replace('sms:${CONTACT.phoneDirectTel}', 'sms:+15555550100')
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater },
    })
    expect(p.join('\n')).toMatch(/Text us|CONTACT/)
  })

  it('refuses an elevation shadow on the FAB', () => {
    const css = `${live.css}\n.v3-dog-floater { box-shadow: 0 1px 6px color-mix(in srgb, var(--v3-navy) 16%, transparent); }`
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, css },
    })
    expect(p.join('\n')).toMatch(/elevation|one-design-system|focus ring/i)
  })

  it('refuses a FAB that cannot second-tap close or that fights Tour', () => {
    const floater = live.floater
      .replaceAll('DialogTrigger', 'DialogRoot')
      .replaceAll('v3-dog-floater--listing', 'v3-dog-floater--wide')
    const css = live.css
      .replaceAll('ease-in-out', 'ease-out')
      .replaceAll('listing-ask-row', 'listing-cta-row')
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater, css },
    })
    expect(p.join('\n')).toMatch(/DialogTrigger|listing|Tour|ease-in-out/)
  })

  it('ci:dog-floater exits 0 on HEAD', () => {
    const r = spawnSync('node', [join(REPO, 'scripts/check-dog-floater.mjs')], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(DOG_FLOATER_GATE)
  })
})
