import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = join(process.cwd(), 'app/contact/page.tsx')
const FOLD_CSS = join(process.cwd(), 'app/contact/_v3/contact-fold.css')

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

  it('imports the installed beui-input and shadcn-input sources on the route', () => {
    const catalog = readFileSync(join(process.cwd(), 'app/contact/_v3/contact-catalog.ts'), 'utf8')
    const ask = readFileSync(join(process.cwd(), 'app/contact/_v3/ContactAsk.client.tsx'), 'utf8')
    const field = readFileSync(join(process.cwd(), 'app/contact/_v3/ContactField.client.tsx'), 'utf8')
    expect(catalog).toMatch(/from '@\/components\/motion\/input'/)
    expect(catalog).toMatch(/from '@\/components\/ui\/input'/)
    expect(field).toContain('BeuiInput')
    expect(field).toContain('error={error}')
    expect(field).toContain('success={success}')
    expect(ask).toContain('Field={ContactField}')
    expect(ask).toContain('data-taste="error-open"')
    expect(ask).toContain('data-taste="success-open"')
    expect(catalog).toMatch(/from '@\/components\/ui\/select'/)
  })

  it('puts house-faces and hours-empty on the default fold', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('size="compact"')
    expect(src).toContain('ContactHoursLive')
    expect(src).toContain('from ${reviewSummary.count} Google reviews')
  })

  it('puts the Bend office street on the default fold', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('BRAND.address.street')
    expect(src).toContain('streetAddress: BRAND.address.street')
  })

  it('puts the ask beside the reach control on a wide viewport', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    expect(css).toContain('contact-fold__write')
    expect(css).toContain('grid-template-columns')
    expect(css).toContain('var(--v3-measure)')
    expect(css).not.toMatch(/#(?:102742|faf8f4)/i)
  })

  it('keeps house-doors hierarchy and the hero-width lead still', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    expect(css).toContain('min-width: 20rem')
    expect(css).not.toContain('repeat(3, minmax(0, 1fr))')
    expect(css).toContain('about-faces--compact')
    expect(css).toMatch(/\.contact-fold \.about-faces \{\s*order: 2;/)
    expect(css).toMatch(/\.contact-fold \.v3\.v3-doors \{\s*order: 3;/)
  })
})
