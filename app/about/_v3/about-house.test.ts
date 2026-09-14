import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ABOUT_FIRM_STORY } from '@/app/about/_v3/about-constants'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const FIRM = readFileSync('app/about/_v3/AboutFirm.tsx', 'utf8')
const OFFICE = readFileSync('app/about/_v3/AboutOffice.tsx', 'utf8')
const INQUIRY = readFileSync('app/about/_v3/AboutInquiry.tsx', 'utf8')
const FOLD = readFileSync('app/about/_v3/about-fold.css', 'utf8')
const LOAD = readFileSync('app/about/_v3/load-about-faces.ts', 'utf8')
const CLOSINGS = readFileSync('app/about/_v3/FirmClosings.tsx', 'utf8')
const FOLD_JSX = PAGE.slice(PAGE.indexOf('className="about-fold"'), PAGE.indexOf('id="proof"'))

describe('SITE-90 /about brokerage fold', () => {
  it('parity cannot pass a Meet-the-Team About', () => {
    const parity = JSON.parse(
      readFileSync('design_system/ryan-realty/ui_kits/about/parity.json', 'utf8'),
    ) as {
      competitiveTarget: string
      note: string
      competitiveBrief: { id: string; beats: { id: string; text: string }[] }
      requiredComponents: { name: string; section: string }[]
      removedComponents: string[]
      tasteReview: { competitiveBriefPass: boolean }
    }
    const names = parity.requiredComponents.map((c) => c.name)
    expect(names).toContain('AboutFirm')
    expect(names).toContain('V3Proof')
    expect(names).toContain('FirmClosings')
    expect(names).toContain('V3Doors')
    expect(names).toContain('AboutOffice')
    expect(names).toContain('AboutInquiry')
    expect(names).not.toContain('AboutFaces')
    expect(names).not.toContain('AboutTeamTeaser')
    expect(parity.competitiveTarget).toMatch(/FAIL if the page opens on brokers' faces/)
    expect(parity.note).toMatch(/not Meet the Team/)
    expect(parity.competitiveBrief.id).toBe('about-matt-2026-09-12')
    expect(parity.competitiveBrief.beats.map((b) => b.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(parity.competitiveBrief.beats[0]?.text).toMatch(/boutique/)
    expect(parity.competitiveBrief.beats[1]?.text).toMatch(/belong on \/team/)
    expect(parity.tasteReview.competitiveBriefPass).toBe(false)
    const opener = parity.requiredComponents.find((c) => c.name === 'AboutFirm')
    expect(opener?.section).toMatch(/OPENS THE PAGE/)
    expect(opener?.section).toMatch(/NOT three broker Cards/)
    expect(parity.removedComponents.some((row) => row.startsWith('AboutFaces'))).toBe(true)
    expect(parity.removedComponents.some((row) => row.startsWith('AboutTeamTeaser'))).toBe(true)
  })

  it('opens on the firm purpose, not three broker Cards', () => {
    expect(PAGE).toContain('<AboutFirm')
    expect(PAGE).not.toContain('<AboutFaces')
    expect(PAGE).not.toContain('<AboutTeamTeaser')
    expect(PAGE).not.toContain('Meet the team')
    expect(PAGE).not.toContain('size="proof"')
    expect(PAGE).not.toContain('size="editorial"')
    expect(PAGE).not.toContain('openingFigures')
    expect(FIRM).toContain('ABOUT_FIRM_STORY')
    expect(ABOUT_FIRM_STORY).toBe(
      'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.',
    )
    expect(PAGE).not.toContain('primary: true')
    expect(PAGE).not.toContain('id="team-teaser"')
    expect(PAGE).not.toContain('Who you work with')
  })

  it('puts Google reviews on V3Proof as the first proof band, not a hero score link', () => {
    expect(FIRM).not.toContain('Google reviews')
    expect(FIRM).not.toContain('proof.value')
    expect(FIRM).not.toContain('quote.pull')
    expect(PAGE).toContain("href: '/reviews'")
    expect(PAGE).toContain('value: reviewAverage.toFixed(1)')
    expect(PAGE).toContain("label: 'Average rating'")
    expect(PAGE).toContain("label: 'Google reviews'")
    expect(PAGE).toContain('id="proof"')
    expect(PAGE).not.toContain('featuredQuote')
    expect(PAGE).not.toContain('firmBeat')
    expect(FOLD).toContain('about-fold__proof')
    expect(FOLD).toContain('--v3-size-num-lead')
  })

  it('loads the firm closing set, not a one-row tease', () => {
    expect(LOAD).toContain('getBrokerSales')
    expect(LOAD).toContain('getBrokerageListingTiles')
    expect(LOAD).toContain('publishFirmClosingRows')
    expect(LOAD).toContain('uniqueListingTiles')
    expect(LOAD).toContain('FIRM_CLOSING_LIMIT')
    expect(PAGE).toContain('loadAboutProof')
    expect(CLOSINGS).toContain('V3Carousel')
    expect(CLOSINGS).toContain('mode="rail"')
    expect(CLOSINGS).toContain('See this closing')
    expect(CLOSINGS).not.toContain('V3SourceLine')
    expect(CLOSINGS).not.toContain('how we calculate this')
  })

  it('uses the office exterior as the mood hero, never the sofa', () => {
    expect(FOLD_JSX).toContain('ryan-realty-bend-office-exterior-01.jpg')
    expect(FOLD_JSX).not.toContain('ryan-realty-bend-office-interior')
    expect(FOLD_JSX).toContain('BEND OFFICE ·')
    expect(FOLD_JSX).toContain('BRAND.address.street')
    expect(FOLD).not.toMatch(/70vh|64vh/)
  })

  it('prints the Bend office and firm OREA, not a broker roster', () => {
    expect(PAGE).toContain('<AboutOffice')
    expect(OFFICE).toContain("from '@/components/ui/card'")
    expect(OFFICE).toContain('BRAND.address.street')
    expect(OFFICE).toContain('FIRM_LICENSE')
    expect(OFFICE).toContain('The brokers are on /team')
    expect(OFFICE).not.toContain('Avatar')
    expect(OFFICE).not.toContain('Meet the team')
    expect(FOLD).toContain('about-office')
    expect(FOLD).toContain('Navy and cream only')
  })

  it('sends the one-line inquiry to Contact, not a second form', () => {
    expect(PAGE).toContain('<AboutInquiry')
    expect(INQUIRY).toContain('action="/contact"')
    expect(INQUIRY).toContain('method="get"')
    expect(INQUIRY).toContain('name="inquiry"')
    expect(INQUIRY).toContain('Send a message')
    expect(INQUIRY).not.toContain('submitContactForm')
  })

  it('adds crawlable team, closing, and review lists to JSON-LD', () => {
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
    expect(FIRM).not.toContain('how we calculate this')
    expect(FOLD).not.toContain('how we calculate this')
  })
})
