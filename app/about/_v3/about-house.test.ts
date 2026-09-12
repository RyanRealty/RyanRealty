import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const HERO = readFileSync('app/about/_v3/AboutFirmHero.tsx', 'utf8')
const TEASER = readFileSync('app/about/_v3/AboutTeamTeaser.tsx', 'utf8')
const FOLD = readFileSync('app/about/_v3/about-fold.css', 'utf8')
const LOAD = readFileSync('app/about/_v3/load-about-faces.ts', 'utf8')
const CLOSINGS = readFileSync('app/about/_v3/FirmClosings.tsx', 'utf8')

describe('/about Looking house fold', () => {
  it('adapts shadcn Avatar into the team teaser and carousel into closings', () => {
    expect(TEASER).toMatch(/from ['"]@\/components\/ui\/avatar['"]/)
    expect(TEASER).toContain('AvatarImage')
    expect(TEASER).toContain('AvatarFallback')
    expect(TEASER).not.toContain('<Card')
    expect(TEASER).not.toContain('ButtonGroup')
    expect(TEASER).not.toContain('>Call<')
    expect(CLOSINGS).toMatch(/from ['"]@\/components\/ui\/card['"]/)
    expect(CLOSINGS).toContain('V3Carousel')
    expect(CLOSINGS).toContain('mode="rail"')
  })

  it('opens as a firm hero, not three broker Cards', () => {
    expect(PAGE).toContain('<AboutFirmHero')
    expect(HERO).toContain('id="firm"')
    expect(HERO).toContain('about-firm__place')
    expect(PAGE).not.toContain('size="proof"')
    expect(PAGE).not.toContain('size="editorial"')
    expect(PAGE).not.toContain('openingFigures')
  })

  it('puts reviews first among proof bands, with the live Google mark as the headline', () => {
    expect(PAGE).toContain('id="proof"')
    expect(PAGE).toContain('headline={`${reviewAverage.toFixed(1)} from ${reviewCount} Google reviews`}')
    expect(PAGE).toContain("href: '/reviews'")
    expect(PAGE).toContain('BROKERS.matt.nameShort')
    expect(PAGE).toContain('BROKERS.rebecca.nameShort')
    expect(PAGE).toContain('BROKERS.paul.nameShort')
    expect(PAGE).toContain('firmBeat')
    expect(PAGE).toContain('The person you call is the person who works your purchase or sale through closing.')
  })

  it('loads sourced closings and a photo+name teaser, not per-broker Call buttons', () => {
    expect(LOAD).toContain('getBrokerSales')
    expect(LOAD).toContain('getBrokerageListingTiles')
    expect(LOAD).toContain('publishFirmClosingRows')
    expect(PAGE).toContain('loadAboutProof')
    expect(PAGE).toContain('<AboutTeamTeaser')
    expect(TEASER).toContain('teamPath()')
    expect(TEASER).toContain('Who you work with')
    expect(TEASER).not.toContain('person.license')
    expect(TEASER).not.toContain('OR #')
    expect(TEASER).not.toContain('tel:')
    expect(TEASER).not.toContain('sms:')
    expect(TEASER).not.toContain('mailto:')
  })

  it('puts the Street View exterior on the firm hero and closings after reviews', () => {
    expect(PAGE).toContain('<FirmClosings')
    expect(PAGE).toContain('ryan-realty-bend-office-exterior-01.jpg')
    expect(PAGE).not.toContain('ryan-realty-bend-office-interior')
    expect(PAGE).toContain('BEND OFFICE')
    expect(FOLD).toMatch(/grid-template-columns: minmax\(0, 1fr\) minmax\(16rem, 22rem\)/)
    expect(FOLD).not.toContain('about-faces--proof')
    expect(CLOSINGS).toContain('See this closing')
  })

  it('adds crawlable broker and closing lists to JSON-LD', () => {
    expect(PAGE).toContain("name: 'Ryan Realty brokers'")
    expect(PAGE).toContain("name: 'Recent Ryan Realty closings'")
    expect(PAGE).toContain("type: 'dataset'")
    expect(PAGE).toContain('Average Google rating')
  })

  it('keeps methodology chrome off the About fold', () => {
    const body = PAGE.slice(PAGE.indexOf('export default'))
    expect(body).not.toContain('V3SourceLine')
    expect(body).not.toContain('openingTrace')
    expect(body).not.toContain('how we calculate this')
    expect(CLOSINGS).not.toContain('V3SourceLine')
    expect(CLOSINGS).not.toContain('how we calculate this')
  })
})
