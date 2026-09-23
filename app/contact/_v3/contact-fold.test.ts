import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = join(process.cwd(), 'app/contact/page.tsx')
const FOLD_CSS = join(process.cwd(), 'app/contact/_v3/contact-fold.css')
const FIELD = join(process.cwd(), 'app/contact/_v3/ContactField.client.tsx')
const ASK = join(process.cwd(), 'app/contact/_v3/ContactAsk.client.tsx')
const HOURS = join(process.cwd(), 'app/contact/_v3/ContactHoursLive.client.tsx')

describe('contact fold (SITE-80 / SITE-96)', () => {
  it('opens on ContactFold with V3Doors --lead and the catalog ask', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('ContactFold')
    expect(src).toContain('<V3Doors')
    expect(src).toContain('id="reach"')
    expect(src).toContain('primary: true')
    expect(src).toContain("kicker: v3Text('Call')")
    expect(src).toContain("kicker: v3Text('Text')")
    expect(src).toContain("kicker: v3Text('Email')")
    expect(src).toContain("kicker: v3Text('Schedule')")
    expect(src).toContain('<V3OnDuty')
    expect(src).toContain('allowEmpty')
    expect(src).toContain('<AboutFaces')
    expect(src).toContain('<ContactAsk')
    expect(src).toContain('people={faces}')
    expect(src).not.toContain('people={[mattFace]}')
    expect(src).not.toContain('ContactReach')
    expect(src).not.toContain('ButtonGroup')
    expect(src).not.toContain('imageSrc:')
    expect(src).not.toContain('Four equal')
    expect(src).not.toContain('who-answers-sent')
    expect(src).not.toMatch(/CRM response clock/i)
    expect(src).not.toMatch(/RESPONSE CLOCK/i)
    expect(src).not.toMatch(/admin-crm/i)
    expect(existsSync(join(process.cwd(), 'app/contact/_v3/ContactReach.tsx'))).toBe(false)
  })

  it('does not open the default fold on a second broker roster in Quiet', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain("variant === 'quiet-doors'")
    expect(src).not.toContain("label: 'The office'")
  })

  it('imports the installed beui-input and shadcn-input sources on the field', () => {
    const field = readFileSync(FIELD, 'utf8')
    const ask = readFileSync(ASK, 'utf8')
    expect(field).toMatch(/from '@\/components\/motion\/input'/)
    expect(field).toMatch(/from '@\/components\/ui\/input'/)
    expect(field).toContain('BeuiInput')
    expect(field).toContain('error={error}')
    expect(field).toContain('success={success}')
    expect(field).toContain('classNames')
    expect(field).toContain('border-foreground')
    expect(field).toContain('text-foreground')
    expect(field).not.toContain('contact-field__area')
    expect(field).not.toContain('contact-field__error')
    expect(field).not.toContain('contact-field__select')
    expect(ask).toContain('Field={ContactField}')
    expect(ask).toContain('data-taste="error-open"')
    expect(ask).toContain('data-taste="success-open"')
    expect(ask).toContain('data-taste="sent-open"')
    expect(ask).toContain('previewSent')
    expect(ask).not.toContain('done={faces}')
  })

  it('hours-empty keeps the hours product line', () => {
    const hours = readFileSync(HOURS, 'utf8')
    expect(hours).toContain('data-taste="hours-empty"')
    expect(hours).toContain('Hours not published')
    expect(hours).toContain('v3-onduty')
    expect(hours).not.toMatch(/empty \? null/)
  })

  it('puts house-faces and hours-empty on the default fold', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('size="compact"')
    expect(src).toContain('sectionId="who-answers"')
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
    expect(css).toContain('contact-fold__faces')
    expect(css).toContain('grid-column: 1 / -1')
    expect(css).not.toMatch(/#(?:102742|faf8f4)/i)
  })

  it('keeps 375 Quiet → doors → write → faces and the catalog compact table', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    expect(css).toContain('minmax(14rem, 1.2fr)')
    expect(css).toContain('minmax(12rem, 1fr)')
    expect(css).not.toContain('minmax(20rem, 1.2fr)')
    expect(css).not.toContain('.about-faces__role')
    expect(css).not.toContain('.about-faces__license')
    expect(css).not.toContain('.about-faces__reach')
    expect(css).not.toContain('contact-reach__alts')
    expect(css).toMatch(/\.contact-fold \.v3\.v3-quiet \{\s*order: 1;/)
    expect(css).toMatch(/\.contact-fold \.v3\.v3-doors \{\s*order: 2;/)
    expect(css).toMatch(/\.contact-fold__write \{\s*order: 3;/)
    expect(css).toContain('padding-bottom: 8.5rem')
  })

  it('keeps the display phone on one line and sizes it to its door (UXLIVE-12)', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    // The 2026-09-22 capture broke 541.703.3095 after "541.703." at 1440.
    expect(css).toMatch(/\.contact-fold \.v3-doors__door--lead \{\s*container-type: inline-size;/)
    const rule = /\.contact-fold \.v3-doors__door--lead \.v3-doors__label \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toContain('white-space: nowrap')
    expect(rule).toMatch(/font-size: min\(var\(--v3-size-display-1\), \d+cqi\)/)
  })
})
