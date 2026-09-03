import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'
import { TEAM_FAQ_ITEMS } from './team-constants'

const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const FOLD = PAGE.slice(PAGE.indexOf('return ('), PAGE.indexOf('<V3Proof'))

describe('team fold', () => {
  it('opens on the About faces row, not a Quiet graf', () => {
    expect(PAGE).toContain("from '@/app/about/_v3/AboutFaces'")
    expect(PAGE).toContain('aboutFaceFromBroker')
    expect(FOLD).toContain('<AboutFaces')
    expect(FOLD).toContain('heading="The brokers"')
    expect(FOLD).not.toContain('V3Quiet')
    expect(FOLD).not.toContain('valuationHref')
    expect(FOLD).not.toContain('Value my home')
    expect(PAGE).not.toMatch(/number on their card/)
  })

  it('keeps seller off the first screen', () => {
    expect(PAGE).toContain("valuationHref('/team')")
    expect(PAGE).toContain('<V3Answers')
    expect(PAGE).toContain('faqDoors')
  })
})

describe('team roster', () => {
  it('does not print a second broker ledger under the faces', () => {
    expect(PAGE).not.toContain('V3Ledger')
    expect(PAGE).not.toContain('brokerLedgerRow')
    expect(PAGE).not.toContain('id="brokers"')
  })
})

describe('team FAQ', () => {
  it('renders TEAM_FAQ_ITEMS as V3Answers, not a Quiet prose wall', () => {
    expect(PAGE).toContain('TEAM_FAQ_ITEMS')
    expect(PAGE).toContain('V3Answers')
    expect(PAGE).not.toContain("id=\"reviews-faq\"")
    expect(PAGE).not.toMatch(/kind: 'prose' as const,\s*term: item\.question/)
    expect(TEAM_FAQ_ITEMS.length).toBe(4)
    expect(PAGE).toContain('type: \'faqPage\'')
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
