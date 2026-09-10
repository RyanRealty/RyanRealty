import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutCompactReach, aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

const FACES = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
const CSS = readFileSync('app/about/_v3/about-faces.css', 'utf8')
const HOME = readFileSync('app/page.tsx', 'utf8')
const COMPACT_CSS = CSS.slice(CSS.indexOf('COMPACT (homepage, SITE-M1)'))

/**
 * SITE-M1 (Matt 2026-09-07): on a phone the homepage brokers section opens
 * with all three faces, names, licenses, and Call / Text / Book in one
 * screen. The compact variant is the homepage's only; /about and /team keep
 * the roster byte-for-byte.
 */
describe('compact reach rows', () => {
  const matt = aboutFaceFromBroker({
    slug: BROKERS.matt.slug,
    fullName: BROKERS.matt.name,
    title: BROKERS.matt.title,
    headshotPng: '/images/brokers/ryan-matt.png',
    phoneDirect: BROKERS.matt.phone,
    email: BROKERS.matt.email,
  })!

  it('is Call, Text, Book in table order, from the live broker line', () => {
    const rows = aboutCompactReach(matt)
    expect(rows.map((r) => r.kind)).toEqual(['call', 'text', 'book'])
    expect(rows[0]).toEqual({
      kind: 'call',
      href: `tel:${aboutPhoneE164(BROKERS.matt.phone)}`,
      label: 'Call',
      detail: BROKERS.matt.phone,
      ariaLabel: `Call ${BROKERS.matt.nameShort}`,
    })
    expect(rows[1].href).toBe(`sms:${aboutPhoneE164(BROKERS.matt.phone)}`)
    // The digits print once, on Call; Text says so instead of repeating them.
    expect(rows[1].detail).toBe('Same number')
    expect(rows.filter((r) => r.detail === BROKERS.matt.phone)).toHaveLength(1)
    expect(rows[2]).toEqual({
      kind: 'book',
      href: '/book?agent=matt',
      label: 'Book',
      detail: 'Pick a time',
      ariaLabel: `Book time with ${BROKERS.matt.nameShort}`,
    })
  })

  it('never carries Email or Schedule: those stay on the roster and portrait', () => {
    expect(aboutCompactReach(matt).some((r) => r.href.startsWith('mailto:'))).toBe(false)
    expect(aboutCompactReach(matt).map((r) => r.label)).not.toContain('Schedule')
  })

  it('drops the rows a broker cannot take rather than shipping a dead link', () => {
    expect(aboutCompactReach({ ...matt, tel: null, phoneDisplay: null }).map((r) => r.kind)).toEqual(['book'])
    expect(aboutCompactReach({ ...matt, bookHref: null }).map((r) => r.kind)).toEqual(['call', 'text'])
    expect(aboutCompactReach({ ...matt, tel: null, phoneDisplay: null, bookHref: null })).toEqual([])
  })

  it('shows no number it was not given', () => {
    const rows = aboutCompactReach({ ...matt, phoneDisplay: null })
    expect(rows[0].detail).toBeNull()
    expect(rows[1].detail).toBeNull()
  })
})

describe('compact markup', () => {
  it('is an explicit size the homepage passes; /about and /team do not', () => {
    expect(FACES).toContain('size?: "roster" | "portrait" | "compact" | "editorial"')
    expect(HOME).toContain('<AboutFaces people={faces} heading="Talk to a broker" headingLevel={2} size="compact" />')
    expect(readFileSync('app/about/page.tsx', 'utf8')).not.toContain('size="compact"')
    expect(readFileSync('app/team/page.tsx', 'utf8')).not.toContain('size="compact"')
  })

  it('keeps the face, the name door, the license, and the rows in one item', () => {
    const compact = FACES.slice(FACES.indexOf('if (size === "compact")'), FACES.indexOf('if (size === "portrait")'))
    expect(compact).toContain('about-faces--compact')
    expect(compact).toContain('alt={person.name}')
    expect(compact).toContain('className="about-faces__name"')
    expect(compact).toContain('<p className="about-faces__role">{person.title}</p>')
    expect(compact).toContain('OR #{person.license}')
    expect(compact).toContain('aboutCompactReach(person)')
    expect(compact).toContain('`about-faces__reach--${row.kind}`')
    expect(compact).toContain('teamPath()')
  })

  it('opens on the same eyebrow primitive as the other homepage sections', () => {
    const compact = FACES.slice(FACES.indexOf('if (size === "compact")'), FACES.indexOf('if (size === "portrait")'))
    expect(compact).toContain('<V3Eyebrow>Our brokers</V3Eyebrow>')
    expect(compact).toContain('className="about-faces__head-row"')
  })
})

describe('compact css', () => {
  it('is one table: subgrid rows, one column per broker, no box behind a cutout', () => {
    expect(COMPACT_CSS).toMatch(/\.about-faces--compact \.about-faces__grid \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
    expect(COMPACT_CSS).toMatch(/\.about-faces--compact \.about-faces__item \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
    expect(COMPACT_CSS).toMatch(/\.about-faces--compact \.about-faces__item \{[\s\S]*?grid-template-rows: subgrid/)
    expect(COMPACT_CSS).toMatch(/\.about-faces--compact \.about-faces__item \{[\s\S]*?border: 0;[\s\S]*?background: transparent/)
  })

  it('places every row by kind so a missing row cannot shift the others', () => {
    expect(COMPACT_CSS).toMatch(/\.about-faces__item \{[\s\S]*?grid-row: span 7/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__name \{\s*grid-row: 2/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__role \{\s*grid-row: 3/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__license \{\s*grid-row: 4/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__reach--call \{\s*grid-row: 5/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__reach--text \{\s*grid-row: 6/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__reach--book \{\s*grid-row: 7/)
  })

  it('reserves two name lines and fades the cutout on three sides, with no box or fill', () => {
    expect(COMPACT_CSS).toMatch(/\.about-faces__name \{[\s\S]*?min-height: max\(var\(--v3-tap\), calc\(2\.2em \+ var\(--v3-space-xs\)\)\)/)
    const photo = COMPACT_CSS.slice(COMPACT_CSS.indexOf('.about-faces--compact .about-faces__photo {'))
    expect(photo).toMatch(/mask-image:\s*linear-gradient\(to bottom, var\(--v3-navy\) 88%, transparent 100%\),\s*linear-gradient\(to right, transparent 0%, var\(--v3-navy\) 10%, var\(--v3-navy\) 90%, transparent 100%\)/)
    expect(photo).toMatch(/mask-composite: intersect/)
    expect(photo).toMatch(/-webkit-mask-composite: source-in/)
    expect(COMPACT_CSS).not.toMatch(/\.about-faces--compact \.about-faces__photo(-link)? \{[^}]*(background|border:|box-shadow)/)
  })

  it('keeps tap height on every row and the door, tabular numerals on the number', () => {
    expect(CSS).toMatch(/\.about-faces__reach \{[\s\S]*?min-height: var\(--v3-tap\)/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__door \{[\s\S]*?min-height: var\(--v3-tap\)/)
    expect(COMPACT_CSS).toMatch(/\.about-faces__reach-detail \{[\s\S]*?font-variant-numeric: tabular-nums/)
    expect(COMPACT_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('prints the number only from 48rem, where tel: is not a tap', () => {
    const base = COMPACT_CSS.slice(0, COMPACT_CSS.indexOf('@media (min-width: 48rem)'))
    const wide = COMPACT_CSS.slice(COMPACT_CSS.indexOf('@media (min-width: 48rem)'))
    expect(base).toMatch(/\.about-faces__reach-detail \{\s*display: none/)
    expect(wide).toMatch(/\.about-faces--compact \.about-faces__reach-detail \{\s*display: inline-block/)
  })
})
