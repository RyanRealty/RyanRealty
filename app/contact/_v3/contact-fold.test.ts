import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = join(process.cwd(), 'app/contact/page.tsx')
const FOLD_CSS = join(process.cwd(), 'app/contact/_v3/contact-fold.css')
const FIELD = join(process.cwd(), 'app/contact/_v3/ContactField.client.tsx')
const ASK = join(process.cwd(), 'app/contact/_v3/ContactAsk.client.tsx')
const REACH = join(process.cwd(), 'app/contact/_v3/ContactReach.tsx')
const HOURS = join(process.cwd(), 'app/contact/_v3/ContactHoursLive.client.tsx')

describe('contact fold (SITE-80 / SITE-96)', () => {
  it('opens on ContactFold with one Call reach control and the ask', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('ContactFold')
    expect(src).toContain('ContactReach')
    expect(src).toContain('<V3OnDuty')
    expect(src).toContain('allowEmpty')
    expect(src).toContain('<AboutFaces')
    expect(src).toContain('<ContactAsk')
    expect(src).toContain('people={[mattFace]}')
    expect(src).not.toContain('imageSrc:')
    expect(src).not.toContain('Four equal')
    expect(src).not.toContain('who-answers-sent')
    expect(src).not.toMatch(/CRM response clock/i)
    expect(src).not.toMatch(/RESPONSE CLOCK/i)
    expect(src).not.toMatch(/admin-crm/i)
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

  it('keeps Text Email Schedule on one reach control, not four V3Doors cells', () => {
    const reach = readFileSync(REACH, 'utf8')
    expect(reach).toContain('V3Doors')
    expect(reach).toContain("kicker: v3Text('Call')")
    expect(reach).toContain('primary: true')
    expect(reach).toContain('ButtonGroup')
    expect(reach).toContain('>Text</a>')
    expect(reach).toContain('>Email</a>')
    expect(reach).toContain('>Schedule</Link>')
    expect(reach).not.toContain("kicker: v3Text('Text')")
    expect(reach).not.toContain("kicker: v3Text('Email')")
    expect(reach).not.toContain("kicker: v3Text('Schedule')")
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
    expect(css).not.toMatch(/#(?:102742|faf8f4)/i)
  })

  it('keeps house-doors hierarchy and one Matt face at hero width', () => {
    const css = readFileSync(FOLD_CSS, 'utf8')
    expect(css).toContain('minmax(20rem, 1.2fr)')
    expect(css).not.toContain('repeat(3, minmax(0, 1fr))')
    expect(css).toContain('about-faces--compact')
    expect(css).toMatch(/\.contact-fold \.contact-reach \{\s*order: 2;/)
    expect(css).toMatch(/\.contact-fold__write \{\s*order: 3;/)
    expect(css).toContain('padding-bottom: 8.5rem')
  })
})
