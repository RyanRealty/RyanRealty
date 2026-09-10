import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = join(process.cwd(), 'app/contact/page.tsx')
const FOLD_CSS = join(process.cwd(), 'app/contact/_v3/contact-fold.css')
const INPUT_CSS = join(process.cwd(), 'components/site/v3/V3Input.css')

describe('contact fold (SITE-80)', () => {
  it('opens on ContactFold with a hierarchical call door and the ask', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('ContactFold')
    expect(src).toContain('primary: true')
    expect(src).toContain('imageSrc: principal.headshotPng')
    expect(src).toContain('<V3OnDuty')
    expect(src).toContain('<AboutFaces')
    expect(src).toContain('<ContactAsk')
    expect(src).not.toContain('Four equal')
  })

  it('does not open the default fold on a second broker roster in Quiet', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain("variant === 'quiet-doors'")
    expect(src).not.toContain("label: 'The office'")
  })

  it('adapts beui-input shake and success check into V3Input', () => {
    const css = readFileSync(INPUT_CSS, 'utf8')
    expect(css).toContain('v3-input-shake')
    expect(css).toContain('v3-input__check')
    expect(css).toContain(':user-invalid')
    expect(css).toContain(':user-valid')
    expect(css).not.toMatch(/#(?:e11|ef4444|22c55e|16a34a)/i)
  })

  it('puts the ask beside the reach control on a wide viewport', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    expect(css).toContain('contact-fold__write')
    expect(css).toContain('grid-template-columns')
    expect(css).toContain('var(--v3-measure)')
    expect(css).not.toMatch(/#(?:102742|faf8f4)/i)
  })
})
