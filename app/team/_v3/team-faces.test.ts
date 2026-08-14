import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BROKERS } from '@/lib/brand/contact'
import { aboutFaceFromBroker, aboutPhoneE164 } from '@/app/about/_v3/about-faces'

const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const FOLD = PAGE.slice(PAGE.indexOf('return ('), PAGE.indexOf('<V3Ledger'))

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
    expect(PAGE).toContain("...faqItems")
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
