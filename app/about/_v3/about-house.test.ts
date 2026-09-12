import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FACES = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
const PORTRAIT = readFileSync('app/about/_v3/FacePortrait.client.tsx', 'utf8')
const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const CSS = readFileSync('app/about/_v3/about-faces.css', 'utf8')
const FOLD = readFileSync('app/about/_v3/about-fold.css', 'utf8')
const LOAD = readFileSync('app/about/_v3/load-about-faces.ts', 'utf8')

describe('SITE-90 /about house fold', () => {
  it('adapts shadcn Avatar into AboutFaces and FacePortrait', () => {
    expect(FACES).toMatch(/from ['"]@\/components\/ui\/avatar['"]/)
    expect(PORTRAIT).toMatch(/from ['"]@\/components\/ui\/avatar['"]/)
    expect(PORTRAIT).toContain('AvatarBadge')
    expect(PORTRAIT).toContain('AvatarFallback')
  })

  it('opens editorial, not three equal roster columns or a KPI figure row', () => {
    expect(PAGE).toContain('size="editorial"')
    expect(PAGE).toContain('className="about-fold"')
    expect(PAGE).not.toContain('openingFigures')
    expect(PAGE).not.toContain('figures={openingFigures}')
    expect(FACES).toContain('about-faces--house')
    expect(FACES).toContain('about-faces__face-proof')
  })

  it('puts the 5.0 mark on the principal face and links the count to /reviews', () => {
    expect(FACES).toContain('proof={proof?.value}')
    expect(FACES).toContain('from {proof.count} Google reviews')
    expect(FACES).toContain('about-faces__trio')
    expect(PAGE).toContain("href: '/reviews'")
    expect(PAGE).toContain('value: reviewAverage.toFixed(1)')
  })

  it('loads a sourced MLS record per broker instead of identical cards', () => {
    expect(LOAD).toContain('brokerRosterRecord')
    expect(LOAD).toContain('getBrokerSales')
    expect(PAGE).toContain('loadAboutFaces')
    expect(FACES).toContain('faceRecord(leadPerson.record)')
  })

  it('puts recent closings and the Bend office in the first viewport grid', () => {
    expect(PAGE).toContain('about-fold__place')
    expect(PAGE).toContain('ryan-realty-bend-office-interior-01.jpg')
    expect(PAGE).toContain('about-fold__sales')
    expect(PAGE).toContain('<FirmClosings')
    expect(FOLD).toMatch(/grid-template-columns: minmax\(0, 1\.15fr\) minmax\(0, 0\.85fr\)/)
  })

  it('keeps all three faces in the 375 fold and one Call per person', () => {
    expect(CSS).toMatch(/\.about-faces--house \.about-faces__trio \{[\s\S]*?grid-template-columns: repeat\(3/)
    expect(CSS).toContain('.about-faces--house .about-faces__lead > .about-faces__photo-link')
    const editorial = FACES.slice(FACES.indexOf('function editorialReach'), FACES.indexOf('function faceIdentity'))
    expect(editorial).toContain('about-faces__reach--call')
    expect(editorial).toContain('about-faces__reach-text')
    expect(editorial).not.toContain('IconPhone')
  })

  it('adds crawlable broker and closing lists to JSON-LD', () => {
    expect(PAGE).toContain("name: 'Ryan Realty brokers'")
    expect(PAGE).toContain("name: 'Recent Ryan Realty closings'")
    expect(PAGE).toContain("type: 'dataset'")
    expect(PAGE).toContain('Average Google rating')
  })
})
