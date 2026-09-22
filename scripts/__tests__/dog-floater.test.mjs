import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { dogFloaterProblems, dogHeadCropProblems, DOG_FLOATER_GATE, DOG_FLOATER_DOOR_LABELS } from '../lib/dog-floater.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const live = {
  floater: readFileSync(join(REPO, 'components/site/v3/V3DogFloater.client.tsx'), 'utf8'),
  css: readFileSync(join(REPO, 'components/site/v3/V3DogFloater.css'), 'utf8'),
  barrel: readFileSync(join(REPO, 'components/site/v3/index.ts'), 'utf8'),
  layout: readFileSync(join(REPO, 'app/layout.tsx'), 'utf8'),
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

  it('keeps Work with us out of the header (SITE-155)', () => {
    const chrome = readFileSync(join(REPO, 'components/site/v3/V3Chrome.tsx'), 'utf8')
    expect(chrome).not.toMatch(/<V3WorkWithUs/)
  })

  it('refuses remounting the sticky phone dock', () => {
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, layout: live.layout.replace('<V3DogFloater />', '<V3PhoneDock />\n          <V3DogFloater />') },
    })
    expect(p.join('\n')).toMatch(/V3PhoneDock|sticky/)
  })

  it('refuses a builder that crops from brand-kit/rasta', () => {
    const builder = readFileSync(join(REPO, 'scripts/build-jax-head.mjs'), 'utf8')
    const p = dogFloaterProblems({
      root: REPO,
      files: {
        ...live,
        builder: builder
          .replaceAll('public/brand/jax-navy.png', 'brand-kit/rasta/blue-dog-transparent.png')
          .replaceAll('public/brand/jax-white.png', 'brand-kit/rasta/white-dog-trans.png'),
      },
    })
    expect(p.join('\n')).toMatch(/brand-kit\/rasta|jax-navy|jax-white/)
  })

  it('refuses shortened door labels or an em dash in public copy', () => {
    const shortened = live.floater.replace("label: 'List your home'", "label: 'List'")
    const dashed = live.floater.replace('Learn more about us', 'Learn more\u2014about us')
    const shortP = dogFloaterProblems({ root: REPO, files: { ...live, floater: shortened } })
    const dashP = dogFloaterProblems({ root: REPO, files: { ...live, floater: dashed } })
    expect(DOG_FLOATER_DOOR_LABELS).toEqual([
      'List your home',
      'Read our reviews',
      'Give us a call',
      'Send us a message',
      "Get your home's value",
      'Learn more about us',
    ])
    expect(shortP.join('\n')).toMatch(/Do not shorten|EXACTLY/)
    expect(dashP.join('\n')).toMatch(/em dash|U\+2014/)
  })

  it('refuses a menu that drops Give us a call or invents a number', () => {
    const floater = live.floater
      .replace('Give us a call', 'Call now')
      .replace('tel:${CONTACT.phoneDirectTel}', 'tel:+15555550100')
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater },
    })
    expect(p.join('\n')).toMatch(/Give us a call|CONTACT/)
  })

  it('refuses an elevation shadow on the FAB', () => {
    const css = `${live.css}\n.v3-dog-floater { box-shadow: 0 1px 6px color-mix(in srgb, var(--v3-navy) 16%, transparent); }`
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, css },
    })
    expect(p.join('\n')).toMatch(/elevation|one-design-system|focus ring/i)
  })

  it('refuses a FAB that cannot second-tap close or that ships a Close link', () => {
    const floater = live.floater
      .replaceAll('DialogTrigger', 'DialogRoot')
      .replace('data-v3-dog-place="mid-end"', 'data-v3-dog-place="bottom-end"')
    const css = live.css.replaceAll('ease-in-out', 'ease-out')
    const withClose = `${live.floater}\n<button type="button" className="v3-dog-floater-menu__close">Close</button>`
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater, css },
    })
    const closeP = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater: withClose },
    })
    expect(p.join('\n')).toMatch(/DialogTrigger|mid-end|ease-in-out/)
    expect(closeP.join('\n')).toMatch(/Close/)
  })

  it('refuses object-fit:cover, a bottom cookie rest, and a continuous loop', () => {
    const css = live.css
      .replace('object-fit: contain', 'object-fit: cover')
      .replace('top: 50%;', 'bottom: calc(var(--v3-space-md) + env(safe-area-inset-bottom, 0px));')
      .replace(
        'animation: v3-dog-notice 1.35s ease-in-out 1;',
        'animation: v3-dog-notice 1.35s ease-in-out infinite;',
      )
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, css },
    })
    expect(p.join('\n')).toMatch(/object-fit:cover|contain|mid-end|cookie|infinite|continuous|bottom/i)
  })

  it('keeps jax-head silhouettes inset so the circle cannot crop the muzzle', async () => {
    await expect(dogHeadCropProblems({ root: REPO })).resolves.toEqual([])
  })

  it('refuses a circular pre-crop and an edge-tight head', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dog-floater-head-'))
    mkdirSync(join(root, 'public/brand'), { recursive: true })
    const circle = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="90" fill="#102742"/></svg>`,
    )
    const edge = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 16, g: 39, b: 66, alpha: 1 } },
    })
      .png()
      .toBuffer()
    await sharp(circle).png().toFile(join(root, 'public/brand/jax-head-navy.png'))
    writeFileSync(join(root, 'public/brand/jax-head-cream.png'), edge)
    const p = (await dogHeadCropProblems({ root })).join('\n')
    expect(p).toMatch(/circular pre-crop/)
    expect(p).toMatch(/touch the square edge|too tight/)
  })

  it('refuses a fat ~16% pad that leaves a ring around the head', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dog-floater-fat-'))
    mkdirSync(join(root, 'public/brand'), { recursive: true })
    const fat = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect x="41" y="48" width="140" height="168" fill="#102742"/></svg>`,
    )
    await sharp(fat).png().toFile(join(root, 'public/brand/jax-head-navy.png'))
    await sharp(fat).png().toFile(join(root, 'public/brand/jax-head-cream.png'))
    const p = (await dogHeadCropProblems({ root })).join('\n')
    expect(p).toMatch(/fat pad|does not fill the disc|16%/)
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
