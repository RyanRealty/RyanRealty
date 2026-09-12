import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FACES = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
const PORTRAIT = readFileSync('app/about/_v3/FacePortrait.client.tsx', 'utf8')
const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const CSS = readFileSync('app/about/_v3/about-faces.css', 'utf8')
const FOLD = readFileSync('app/about/_v3/about-fold.css', 'utf8')
const LOAD = readFileSync('app/about/_v3/load-about-faces.ts', 'utf8')
const CLOSINGS = readFileSync('app/about/_v3/FirmClosings.tsx', 'utf8')

const proofIf = FACES.indexOf('if (size === "proof")')
const proofReturn = FACES.indexOf('return (', proofIf)
const rosterReturn = FACES.indexOf('\n  return (', proofReturn + 8)
const PROOF = FACES.slice(proofIf, rosterReturn)
const FOLD_JSX = PAGE.slice(PAGE.indexOf('className="about-fold"'), PAGE.indexOf('id="reach"'))

describe('SITE-90 /about house fold', () => {
  it('adapts shadcn Avatar + ButtonGroup + Card into the fold', () => {
    expect(FACES).toMatch(/from ['"]@\/components\/ui\/avatar['"]/)
    expect(FACES).toMatch(/from ['"]@\/components\/ui\/button['"]/)
    expect(FACES).toMatch(/from ['"]@\/components\/ui\/button-group['"]/)
    expect(PROOF).toContain('AvatarGroup')
    expect(PROOF).toContain('AvatarImage')
    expect(PROOF).toContain('AvatarFallback')
    expect(PROOF).toContain('AvatarBadge')
    expect(PROOF).toContain('ButtonGroup')
    expect(CLOSINGS).toMatch(/from ['"]@\/components\/ui\/card['"]/)
    expect(CLOSINGS).toContain('CardTitle')
    expect(CLOSINGS).toContain('CardDescription')
    expect(CLOSINGS).toContain('CardAction')
    expect(PORTRAIT).toMatch(/from ['"]@\/components\/ui\/avatar['"]/)
    expect(PORTRAIT).not.toMatch(/<img[\s\S]*onError/)
  })

  it('opens as one proof object, not stacked broker cards or a KPI row', () => {
    expect(PAGE).toContain('size="proof"')
    expect(PAGE).toContain('className="about-fold"')
    expect(PAGE).not.toContain('size="editorial"')
    expect(PAGE).not.toContain('openingFigures')
    expect(PAGE).not.toContain('figures={openingFigures}')
    expect(PROOF).toContain('about-faces--proof')
    expect(PROOF).toContain('about-faces__proof-group')
    expect(PROOF).toContain('about-faces__ask')
    expect(PROOF).not.toContain('about-faces__lead')
    expect(PROOF).not.toContain('about-faces__companions')
    expect(PROOF).not.toContain('about-faces__trio')
  })

  it('puts the 5.0 mark on the principal AvatarBadge and links the count to /reviews', () => {
    expect(PROOF).toContain('AvatarBadge')
    expect(PROOF).toContain('from {proof.count} Google reviews')
    expect(PAGE).toContain("href: '/reviews'")
    expect(PAGE).toContain('value: reviewAverage.toFixed(1)')
  })

  it('loads a sourced MLS record for the principal instead of three identical cards', () => {
    expect(LOAD).toContain('brokerRosterRecord')
    expect(LOAD).toContain('getBrokerSales')
    expect(PAGE).toContain('loadAboutFaces')
    expect(PROOF).toContain('leadPerson.record')
  })

  it('puts recent closings in the first viewport and refuses an office stand-in', () => {
    expect(PAGE).toContain('about-fold__sales')
    expect(PAGE).toContain('<FirmClosings')
    expect(FOLD_JSX).not.toContain('about-fold__place')
    expect(FOLD_JSX).not.toContain('ryan-realty-bend-office-interior')
    expect(FOLD).toMatch(/grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/)
  })

  it('keeps the AvatarGroup overlap and one joined ask', () => {
    expect(CSS).toContain('.about-faces--proof .about-faces__proof-group')
    expect(CSS).not.toMatch(/\.about-faces--proof[\s\S]*margin-inline-start: 0/)
    expect(PROOF).toContain('about-faces__ask')
    expect(PROOF).toContain('>Call<')
    expect(PROOF).toContain('>Book<')
  })

  it('adds crawlable broker and closing lists to JSON-LD', () => {
    expect(PAGE).toContain("name: 'Ryan Realty brokers'")
    expect(PAGE).toContain("name: 'Recent Ryan Realty closings'")
    expect(PAGE).toContain("type: 'dataset'")
    expect(PAGE).toContain('Average Google rating')
  })
})
