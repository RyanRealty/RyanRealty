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
    const dashed = live.floater.replace(
      "List your home, read our reviews, give us a call, send us a message, get your\n            home&apos;s value, or learn more about us.",
      'List your home — or not.',
    )
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

  it('refuses a menu that drops the call door or invents a number', () => {
    const floater = live.floater
      .replace('Give us a call', 'Call now')
      .replace('tel:${CONTACT.phoneDirectTel}', 'tel:+15555550100')
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, floater },
    })
    expect(p.join('\n')).toMatch(/Give us a call|CONTACT/)
  })

  it('refuses a reintroduced cream-filled default (the "out of sight" bug)', () => {
    const css = live.css.replace(
      /\.v3-dog-floater\s*\{([^}]*)background:\s*var\(--v3-navy\)/,
      '.v3-dog-floater {$1background: var(--v3-cream)',
    )
    const p = dogFloaterProblems({ root: REPO, files: { ...live, css } })
    expect(p.join('\n')).toMatch(/cream-filled default|blends/i)
  })

  it('refuses an un-raised bottom offset', () => {
    const css = live.css.replace(
      '--v3-dog-fab-bottom: calc(var(--v3-space-3xl) + env(safe-area-inset-bottom, 0px));',
      '--v3-dog-fab-bottom: calc(var(--v3-space-md) + env(safe-area-inset-bottom, 0px));',
    )
    const p = dogFloaterProblems({ root: REPO, files: { ...live, css } })
    expect(p.join('\n')).toMatch(/raised a full|space-3xl/)
  })

  it('refuses a dropped flourish or one that never inverts', () => {
    const noFlourish = live.css.replace(/@keyframes v3-dog-flourish \{[\s\S]*?\n\}\n\n/, '')
    const noInvert = live.css.replace('rotateY(180deg)', 'rotateY(45deg)')
    const p1 = dogFloaterProblems({ root: REPO, files: { ...live, css: noFlourish } })
    const p2 = dogFloaterProblems({ root: REPO, files: { ...live, css: noInvert } })
    expect(p1.join('\n')).toMatch(/flip-spin flourish/)
    expect(p2.join('\n')).toMatch(/invert/i)
  })

  it('refuses a modal Dialog (breaks the second-tap toggle — verified in a browser)', () => {
    const floater = live.floater.replace('<Dialog open={open} onOpenChange={onOpenChange} modal={false}>', '<Dialog open={open} onOpenChange={onOpenChange}>')
    expect(floater).not.toEqual(live.floater)
    const p = dogFloaterProblems({ root: REPO, files: { ...live, floater } })
    expect(p.join('\n')).toMatch(/modal=\{false\}/)
  })

  it('refuses a reintroduced visible Close link', () => {
    const floater = live.floater.replace(
      '</nav>',
      '</nav>\n          <button className="v3-dog-floater-menu__close">Close</button>',
    )
    const p = dogFloaterProblems({ root: REPO, files: { ...live, floater } })
    expect(p.join('\n')).toMatch(/visible "Close" text link/)
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

  it('refuses object-fit:cover and a 70% static idle', () => {
    const css = live.css
      .replace('object-fit: contain', 'object-fit: cover')
      .replace(
        /@keyframes v3-dog-tilt \{[\s\S]*?\n\}/,
        `@keyframes v3-dog-tilt {
  0%,
  70%,
  100% {
    transform: rotate(0deg);
  }
  80% {
    transform: rotate(-5deg);
  }
}`,
      )
    const p = dogFloaterProblems({
      root: REPO,
      files: { ...live, css },
    })
    expect(p.join('\n')).toMatch(/object-fit:cover|contain|70%|frozen/i)
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
