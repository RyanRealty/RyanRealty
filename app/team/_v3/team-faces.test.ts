import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const FOLD = PAGE.slice(PAGE.indexOf('return ('))

describe('team fold', () => {
  it('is the roster only: faces with Call/Text, not a second About', () => {
    expect(PAGE).toContain("from '@/app/about/_v3/AboutFaces'")
    expect(PAGE).toContain('aboutFaceFromBroker')
    expect(FOLD).toContain('<AboutFaces')
    expect(FOLD).toContain('heading="The brokers"')
    expect(FOLD).not.toContain('V3Quiet')
    expect(PAGE).not.toContain('valuationHref')
    expect(PAGE).not.toContain('Value my home')
    expect(PAGE).not.toContain('V3Proof')
    expect(PAGE).not.toContain('V3Answers')
    expect(PAGE).not.toContain('TEAM_FAQ_ITEMS')
    expect(PAGE).not.toMatch(/number on their card/)
  })
})

describe('team roster', () => {
  it('does not print a second broker ledger under the faces', () => {
    expect(PAGE).not.toContain('V3Ledger')
    expect(PAGE).not.toContain('brokerLedgerRow')
    expect(PAGE).not.toContain('id="brokers"')
  })
})

describe('team face phones', () => {
  it('derives call and text from the live brand line, never an invented number', () => {
    const matt = aboutFaceFromBroker({
      slug: BROKERS.matt.slug,
      fullName: BROKERS.matt.name,
      title: BROKERS.matt.title,
      headshotPng: '/images/brokers/ryan-matt.png',
      phoneDirect: BROKERS.matt.phone,
    })
    expect(matt?.tel).toBe(aboutPhoneE164(BROKERS.matt.phone))
    expect(matt?.href).toBe('/team/matthew-ryan')
  })
})

describe('team roster density', () => {
  it('keeps 1440 roster photos at card-photo scale, not carousel posters', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).not.toMatch(/70vh/)
    const desktop = css.slice(css.indexOf('@media (min-width: 48rem)'))
    const rosterPhoto = desktop.slice(
      desktop.indexOf('.about-faces__photo-link'),
      desktop.indexOf('.about-faces--solo .about-faces__grid'),
    )
    expect(rosterPhoto).toMatch(/--v3-card-photo-w/)
    expect(rosterPhoto).not.toMatch(/--v3-carousel-h/)
  })
})
