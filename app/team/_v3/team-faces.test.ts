import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const FOLD = PAGE.slice(PAGE.indexOf('return ('))

describe('team fold', () => {
  it('is the roster only: faces with Call/Text/Email/Schedule, not a second About', () => {
    expect(PAGE).toContain("from '@/app/about/_v3/AboutFaces'")
    expect(PAGE).toContain('aboutFaceFromBroker')
    expect(FOLD).toContain('<AboutFaces')
    expect(FOLD).toContain('heading="The brokers"')
    expect(FOLD).toContain('size="editorial"')
    expect(FOLD).toContain('team-fold')
    expect(FOLD).not.toContain('V3Quiet')
    expect(PAGE).not.toContain('valuationHref')
    expect(PAGE).not.toContain('Value my home')
    expect(PAGE).not.toContain('V3Proof')
    expect(PAGE).not.toContain('V3Answers')
    expect(PAGE).not.toContain('TEAM_FAQ_ITEMS')
    expect(PAGE).not.toMatch(/number on their card/)
  })
})

describe('SITE-166 display-scale portraits', () => {
  const TRIO = readFileSync('app/team/_v3/TeamTrio.tsx', 'utf8')
  const TRIO_CSS = readFileSync('app/team/_v3/team-trio.css', 'utf8')
  const FOLD_CSS = readFileSync('app/team/_v3/team-fold.css', 'utf8')

  it('opens the fold on TeamTrio, not a 32px kicker above Matt Ryan', () => {
    expect(FOLD.indexOf('<TeamTrio')).toBeGreaterThan(0)
    expect(FOLD.indexOf('<TeamTrio')).toBeLessThan(FOLD.indexOf('<AboutFaces'))
    expect(TRIO).toContain('team-trio__avatar--display')
    expect(TRIO).toContain("from '@/components/ui/avatar'")
    expect(TRIO).toContain('AvatarGroup')
    expect(TRIO_CSS).toMatch(/\.team-trio__avatar--display \{[\s\S]*?width: var\(--v3-card-photo-w\)/)
    expect(TRIO_CSS).toContain('calc(var(--v3-card-photo-w) * 1.45)')
    expect(FOLD_CSS).toMatch(/\.team-fold__trio \{[\s\S]*?order: 0/)
    expect(FOLD_CSS).toMatch(/grid-row: 1/)
    expect(FOLD_CSS).not.toContain('5.5rem')
  })

  it('uses canonical PNG headshots and does not invent a rectangular box', () => {
    expect(TRIO).toContain('person.src')
    expect(TRIO).not.toContain('.jpg')
    expect(TRIO_CSS).not.toContain('background: var(--v3-white)')
    expect(TRIO_CSS).toContain('border-radius: 50%')
    expect(PAGE).toContain('preload(faces[0].src')
  })

  it('keeps sourced closing counts on the editorial record, never a hard-coded tally', () => {
    expect(FOLD).toContain('size="editorial"')
    expect(PAGE).toContain('brokerRosterRecord')
    expect(PAGE).not.toMatch(/['"]8['"]\s*\/\s*['"]3['"]/)
    expect(PAGE).not.toContain('closings in the last 12 months')
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
    expect(matt?.bookHref).toBe('/book?agent=matt')
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

describe('team card credentials', () => {
  it('carries Oregon license onto each face from live broker data', () => {
    const matt = aboutFaceFromBroker({
      slug: BROKERS.matt.slug,
      fullName: BROKERS.matt.name,
      title: BROKERS.matt.title,
      headshotPng: '/images/brokers/ryan-matt.png',
      phoneDirect: BROKERS.matt.phone,
      licenseNumber: BROKERS.matt.license,
    })
    expect(matt?.license).toBe(BROKERS.matt.license)
    const faces = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
    expect(faces).toContain('about-faces__license')
  })
})
