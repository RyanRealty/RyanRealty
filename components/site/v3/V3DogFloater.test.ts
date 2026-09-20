import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/v3/V3DogFloater.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3DogFloater.css'), 'utf8')
const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
const CHROME = readFileSync(resolve('components/site/v3/V3Chrome.tsx'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')

describe('V3DogFloater · SITE-134 / SITE-135 / SITE-146', () => {
  it('is mounted once on the public layout and exported from the barrel', () => {
    expect(LAYOUT).toContain('<V3DogFloater')
    expect(LAYOUT).not.toMatch(/<V3PhoneDock/)
    expect(BARREL).toContain("from './V3DogFloater.client'")
    expect(CHROME).toContain('<V3WorkWithUs surface="chrome" placement="chrome"')
  })

  it('opens the five named doors on real routes', () => {
    expect(SRC).toContain('Sell your home')
    expect(SRC).toContain('Buy your home')
    expect(SRC).toContain('Text us')
    expect(SRC).toContain("Get your home's value")
    expect(SRC).toContain('Learn about us')
    expect(SRC).toContain("href: '/sell'")
    expect(SRC).toContain("href: '/buy'")
    expect(SRC).toContain("href: '/sell#get-value'")
    expect(SRC).toContain("href: '/about'")
    expect(SRC).toContain('CONTACT.phoneDirectTel')
  })

  it('is a named circle with CSS dog motion and a Dialog menu', () => {
    expect(SRC).toContain('Open Ryan Realty menu')
    expect(SRC).toContain("from '@/components/ui/dialog'")
    expect(SRC).toContain('DialogTrigger')
    expect(SRC).toContain('/brand/jax-head-navy.png')
    expect(SRC).toContain('/brand/jax-head-cream.png')
    expect(SRC).toContain('data-v3-dog-head="inner"')
    expect(SRC).toContain('data-v3-dog-idle="tilt"')
    expect(SRC).toContain('v3-dog-floater--listing')
    expect(SRC).toContain('Help')
    expect(CSS).toMatch(/border-radius:\s*50%/)
    expect(CSS).toContain('@keyframes v3-dog-tilt')
    expect(CSS).toContain('ease-in-out')
    expect(CSS).toMatch(/rotate\(-6deg\)/)
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
})
