import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/team/[slug]/page.tsx', 'utf8')
const BODY = PAGE.slice(PAGE.indexOf('return ('))

function at(marker: string): number {
  const i = BODY.indexOf(marker)
  expect(i, marker).toBeGreaterThan(-1)
  return i
}

describe('broker fold', () => {
  it('opens on a portrait face, not the AboutFaces poster', () => {
    expect(PAGE).toContain("from '@/app/about/_v3/AboutFaces'")
    expect(PAGE).toContain('aboutFaceFromBroker')
    expect(BODY).toContain('<AboutFaces')
    expect(BODY).toContain('size="portrait"')
    expect(BODY).toContain('reach={false}')
    expect(BODY).not.toContain('Value my home')
    expect(BODY).not.toContain('BrokerValuationSheet')
  })
})

describe('broker conversion order (PAGE_INVENTORY §6)', () => {
  it('puts Call/Text/Email on the fold and does not mount a CMA sheet', () => {
    expect(at('id="contact-broker"')).toBeGreaterThan(-1)
    expect(BODY).not.toContain('BrokerValuationSheet')
    expect(PAGE).not.toContain("from './_v3/BrokerValuationSheet.client'")
  })

  it('prints firm proof and firm sales before any personal dashboard', () => {
    expect(at('id="contact-broker"')).toBeLessThan(at('id="profile"'))
    expect(at('id="contact-broker"')).toBeLessThan(at('id="proof"'))
    expect(at('id="proof"')).toBeLessThan(at('id="firm-sales"'))
    expect(at('id="firm-sales"')).toBeLessThan(at('id="record"'))
    expect(at('id="firm-sales"')).toBeLessThan(at('id="track-record"'))
    expect(BODY).toContain('hasOwnSales && record.figures.length')
    expect(PAGE).toContain('hasRealPersonalRecord')
  })
})
