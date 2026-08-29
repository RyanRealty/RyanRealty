import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FOOTER_CSS = readFileSync(resolve('components/site/v3/V3Footer.css'), 'utf8')

describe('v3 chrome tap floor', () => {
  it('keeps footer sitemap links at --v3-tap on every width', () => {
    expect(FOOTER_CSS).toContain('.v3-footer__column-list a')
    expect(FOOTER_CSS).toContain('min-height: var(--v3-tap)')
    expect(FOOTER_CSS).not.toContain('min-height: 2rem')
  })
})
