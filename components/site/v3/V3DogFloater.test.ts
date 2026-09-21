import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3DogFloater.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3DogFloater.css'), 'utf8')
const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')

describe('V3DogFloater · SITE-134 / SITE-135 / SITE-146 / SITE-153', () => {
  it('is mounted once on the public layout and exported from the barrel', () => {
    expect(LAYOUT).toContain('<V3DogFloater')
    expect(LAYOUT).not.toMatch(/<V3PhoneDock/)
    expect(BARREL).toContain("from './V3DogFloater.client'")
    // No assertion about header <V3WorkWithUs> here on purpose: Matt reversed
    // that 2026-09-19 lock on 2026-09-21 ("the dog is taking that job"),
    // docs/plans/CROSS_AGENT_HANDOFF.md. SITE-155 owns the chrome removal;
    // this node's tests must not depend on that file's contents.
  })

  it('opens the six named doors on real routes, in Matt\'s exact order', () => {
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
    expect(publicSrc).not.toContain('—')
    expect(SRC).toContain("href: '/sell'")
    expect(SRC).toContain("href: '/reviews'")
    expect(SRC).toContain("href: '/contact'")
    expect(SRC).toContain("href: '/sell#get-value'")
    expect(SRC).toContain("href: '/about'")
    expect(SRC).toContain('CONTACT.phoneDirectTel')
    expect(SRC).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(SRC).toContain('public/brand/jax-navy.png')
    expect(SRC).toContain('public/brand/jax-white.png')
    expect(SRC).not.toMatch(/brand-kit\/rasta|blue-dog-transparent|white-dog-trans/)
  })

  it('has no visible Close link but stays keyboard-dismissable', () => {
    expect(SRC).not.toMatch(/v3-dog-floater-menu__close/)
    expect(SRC).not.toMatch(/>\s*Close\s*<\/(a|button)>/)
    expect(SRC).not.toMatch(/onEscapeKeyDown|onPointerDownOutside/)
    expect(SRC).toContain("from '@/components/ui/dialog'")
    expect(SRC).toContain('DialogTrigger')
    expect(SRC).toMatch(/<Dialog\s[^>]*modal=\{false\}/)
    expect(SRC).toContain("{open ? 'Close' : 'Open'} Ryan Realty menu")
    expect(CSS).not.toMatch(/v3-dog-floater-menu__close\s*\{/)
  })

  it('is a named circle with CSS dog motion and a Dialog menu', () => {
    expect(SRC).toContain('Ryan Realty menu')
    expect(SRC).toContain('/brand/jax-head-cream.png')
    expect(SRC).toContain('data-v3-dog-head="inner"')
    expect(SRC).toContain('data-v3-dog-idle="tilt"')
    expect(SRC).toContain('data-v3-dog-idle="flourish"')
    expect(SRC).toContain('v3-dog-floater__stage')
    expect(SRC).toContain('v3-dog-floater--listing')
    expect(SRC).toContain('Help')
    expect(CSS).toMatch(/border-radius:\s*50%/)
    expect(CSS).toContain('@keyframes v3-dog-tilt')
    expect(CSS).toContain('@keyframes v3-dog-flourish')
    expect(CSS).toContain('ease-in-out')
    expect(CSS).toMatch(/rotate\(-6deg\)/)
    expect(CSS).toMatch(/rotateY\(\s*180deg/)
    expect(CSS).toContain('object-fit: contain')
    expect(CSS).not.toMatch(/object-fit:\s*cover/)
    expect(CSS).not.toMatch(/0%\s*,\s*70%\s*,\s*100%/)
    expect(CSS).toContain('scale(0.96)')
    expect(CSS).toContain('--v3-travel')
    expect(CSS).toContain('listing-ask-row')
    expect(CSS).toContain('prefers-reduced-motion')
    expect(CSS).toContain('safe-area-inset-bottom')
    expect(CSS).toMatch(/z-index:\s*95/)
    expect(CSS).toContain("data-cookie-notice='chip'")
  })

  it('is solid navy everywhere (SITE-153 — no cream-on-cream blend) and raised off the edge', () => {
    expect(CSS).toMatch(/\.v3-dog-floater\s*\{[^}]*background:\s*var\(--v3-navy\)/)
    expect(CSS).not.toMatch(/\.v3-dog-floater\s*\{[^}]*background:\s*var\(--v3-cream\)/)
    expect(CSS).not.toContain('v3-dog-floater--on-dark')
    expect(CSS).toMatch(/--v3-dog-fab-bottom:\s*calc\(var\(--v3-space-3xl\)/)
  })

  it('kills both motion layers under prefers-reduced-motion', () => {
    const reducedBlock = CSS.match(
      /@media \(prefers-reduced-motion: reduce\) \{\n(\s*\.v3-dog-floater__head,\n\s*\.v3-dog-floater__stage[\s\S]*?)\n\}\n/,
    )
    expect(reducedBlock).not.toBeNull()
    expect(reducedBlock?.[1]).toMatch(/animation:\s*none/)
  })
})
