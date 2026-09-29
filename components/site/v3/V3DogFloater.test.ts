import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3DogFloater.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3DogFloater.css'), 'utf8')
const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')

describe('V3DogFloater · SITE-153', () => {
  it('is mounted once on the public layout and exported from the barrel', () => {
    expect(LAYOUT).toContain('<V3DogFloater')
    expect(LAYOUT).not.toMatch(/<V3PhoneDock/)
    expect(BARREL).toContain("from './V3DogFloater.client'")
  })

  it('opens the six named doors on real routes', () => {
    const doors = [...SRC.matchAll(/label:\s*(['"])(.*?)\1/g)].map((m) => m[2])
    expect(doors).toEqual([
      'List your home',
      'Read our reviews',
      'Give us a call',
      'Send us a message',
      "Get your home's value",
      'Learn more about us',
    ])
    const publicSrc = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(publicSrc).not.toContain('\u2014')
    expect(SRC).toContain("href: '/sell'")
    expect(SRC).toContain("href: '/reviews'")
    expect(SRC).toContain("href: '/contact'")
    expect(SRC).toContain("href: '/sell#get-value'")
    expect(SRC).toContain("href: '/about'")
    expect(SRC).toContain('CONTACT.phoneDirectTel')
    expect(SRC).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(SRC).not.toMatch(/brand-kit\/rasta|blue-dog-transparent|white-dog-trans/)
    expect(SRC).not.toMatch(/<DialogClose\b/)
    expect(SRC).not.toContain('v3-dog-floater-menu__close')
  })

  it('is a named mid-end circle with brief notice motion and a Dialog menu', () => {
    expect(SRC).toContain('Open Ryan Realty menu')
    expect(SRC).toContain("from '@/components/ui/dialog'")
    expect(SRC).toContain('DialogTrigger')
    expect(SRC).toContain('/brand/jax-head-navy.png')
    expect(SRC).toContain('/brand/jax-head-cream.png')
    expect(SRC).toContain('data-v3-dog-head="inner"')
    expect(SRC).toContain('data-v3-dog-idle="notice"')
    expect(SRC).toContain('data-v3-dog-place="mid-end"')
    expect(SRC).toContain('Help')
    expect(CSS).toMatch(/border-radius:\s*50%/)
    expect(CSS).toContain('@keyframes v3-dog-notice')
    expect(CSS).toContain('rotateY(')
    expect(CSS).toContain('rotate(360deg)')
    expect(CSS).toContain('@keyframes v3-dog-notice-disc')
    expect(CSS).toContain('ease-in-out')
    expect(CSS).toContain('object-fit: contain')
    expect(CSS).not.toMatch(/object-fit:\s*cover/)
    expect(CSS).not.toMatch(/\binfinite\b/)
    expect(CSS).not.toContain('cookie-bar-h')
    expect(CSS).toContain('top: 50%')
    expect(CSS).toContain('scale(0.96)')
    expect(CSS).toContain('--v3-travel')
    expect(CSS).toContain('min-width: var(--v3-tap)')
    expect(CSS).toContain('prefers-reduced-motion')
    expect(CSS).toMatch(/z-index:\s*95/)
  })

  it('the whole head turns toward the pointer; the eye itself never moves (Matt 2026-09-24)', () => {
    expect(SRC).toContain("from '@/lib/geo/aim-at-pointer'")
    expect(SRC).toContain("addEventListener('pointermove'")
    // Passive, and captured on window so no descendant can hide the pointer.
    expect(SRC).toContain('{ capture: true, passive: true }')
    expect(SRC).toContain('requestAnimationFrame')
    expect(SRC).toContain('cancelAnimationFrame')
    expect(SRC).toContain('removeEventListener')
    expect(SRC).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    // One aim box turns both dog layers; no drawn pupil moves over the art.
    expect(SRC).toContain('v3-dog-floater__aim')
    expect(SRC).toContain('headAimTransform(aim)')
    expect(SRC).not.toMatch(/pupil/i)
    expect(CSS).not.toMatch(/pupil/i)
    expect(CSS).toContain('.v3-dog-floater__aim {')
    expect(CSS).toContain('transform-origin: 50% 50%')
    // Still the two head PNGs, not a hand-redrawn dog.
    expect(SRC).toContain('/brand/jax-head-cream.png')
    expect(SRC).toContain('/brand/jax-head-navy.png')
    expect(CSS).not.toMatch(/box-shadow\s*:\s*(?!none)[^;]*\d+px\s+\d+px/)
  })
})
