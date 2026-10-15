import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LISTING_TEASER_EN } from '@/lib/sarah/scripts'
import { SARAH_AVATAR_SRC } from '@/lib/sarah/assets'
import { SARAH_TEASER_DELAY_MS } from '@/lib/sarah/teaser'

const SRC = readFileSync(resolve('components/site/v3/V3SarahAssistant.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3SarahAssistant.css'), 'utf8')
const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
const BARREL = readFileSync(resolve('components/site/v3/index.ts'), 'utf8')

describe('V3SarahAssistant · listing teaser', () => {
  it('is mounted on the public layout and exported from the barrel', () => {
    expect(LAYOUT).toContain('<V3SarahAssistant')
    expect(BARREL).toContain("from './V3SarahAssistant.client'")
  })

  it('uses Matt\'s short web intro and does not put unlicensed status in the chrome', () => {
    expect(SRC).toContain('WEB_GREETING_EN')
    expect(SRC).toContain('WEB_SAVED_NOTICE_EN')
    expect(SRC).toContain('data-sarah="saved-notice"')
    expect(SRC).toMatch(/AI assistant/)
    expect(SRC).not.toMatch(/AI assistant, not a licensed broker/)
  })

  it('uses the approved avatar for the launcher, teaser, and Sarah messages', () => {
    expect(SRC).toContain('SARAH_AVATAR_SRC')
    expect(SRC).toContain("from '@/lib/sarah/assets'")
    expect(SARAH_AVATAR_SRC).toBe('/images/sarah/avatar.jpg')
    expect(SRC).not.toMatch(/\/images\/brokers\//)
  })

  it('waits 30s, uses the approved copy, and never auto-opens the panel', () => {
    expect(SRC).toContain('SARAH_TEASER_DELAY_MS')
    expect(SARAH_TEASER_DELAY_MS).toBe(30_000)
    expect(SRC).toContain('SARAH_TEASER_COPY')
    expect(LISTING_TEASER_EN).toBe('Questions about this home? I can help.')
    expect(SRC).toContain("useState(false)")
    expect(SRC).not.toMatch(/setPanelOpen\(true\).*SARAH_TEASER_DELAY/)
    expect(SRC).toContain("trackEvent('sarah_teaser_shown'")
    expect(SRC).toContain("trackEvent('sarah_teaser_clicked'")
  })

  it('is a bottom-end disc above the dock, with a desktop bubble and a phone badge', () => {
    expect(CSS).toContain('bottom: calc(')
    expect(CSS).toContain('--rr-dock-h')
    expect(CSS).toContain('--rr-sticky-bottom')
    expect(CSS).toContain('data-cookie-notice')
    expect(CSS).toMatch(/z-index:\s*92/)
    expect(CSS).toContain('border-radius: 50%')
    expect(CSS).toContain('object-fit: cover')
    expect(CSS).not.toMatch(/object-fit:\s*fill/)
    expect(CSS).toContain('prefers-reduced-motion')
    expect(CSS).toContain('animation: none')
    expect(CSS).toContain('--v3-travel')
    expect(SRC).toContain('data-sarah-teaser="bubble"')
    expect(SRC).toContain('data-sarah-teaser="badge"')
    expect(SRC).toContain('listingTeaserKind')
    expect(publicSrcHasNoEmDash(SRC)).toBe(true)
  })
})

function publicSrcHasNoEmDash(src: string): boolean {
  const publicSrc = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return !publicSrc.includes('\u2014')
}
