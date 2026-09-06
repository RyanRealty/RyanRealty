import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { belongingLine, resortIndexRow } from './community-index-rows'

const PAGE = readFileSync(join(process.cwd(), 'app/communities/page.tsx'), 'utf8')

describe('resortIndexRow', () => {
  it('puts the live count on the door', () => {
    const row = resortIndexRow({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      belonging: 'Golf membership.',
      photoSrc: '/images/tetherow.jpg',
      activeCount: 17,
      medianLine: 'Median list $1,200,000',
      weight: 0.5,
    })
    expect(row?.href).toBe('/communities/tetherow')
    expect(row?.value).toBe('17 for sale')
    expect(row?.weight).toBe(0.5)
    expect(row?.media?.src).toBe('/images/tetherow.jpg')
  })

  it('drops a row with no name', () => {
    expect(
      resortIndexRow({
        slug: 'x',
        name: '  ',
        city: 'Bend',
        belonging: null,
        photoSrc: null,
        activeCount: 0,
        medianLine: null,
      }),
    ).toBeNull()
  })
})

describe('belongingLine', () => {
  it('prefers a membership tier and an amenity over the about sentence', () => {
    expect(
      belongingLine({
        membershipTiers: [{ name: 'Golf' }],
        amenities: [{ name: 'The clubhouse' }],
        aboutProse: ['A long essay about the resort that should not print.'],
      } as never),
    ).toBe('Golf. The clubhouse.')
  })
})

describe('communities index is resorts only', () => {
  it('does not dump every neighborhood into an A-to-Z browser', () => {
    expect(PAGE).not.toMatch(/CommunityIndexBrowser/)
    expect(PAGE).not.toMatch(/Every community, A to Z/)
    expect(PAGE).toMatch(/headingLevel=\{1\}/)
    expect(PAGE).not.toMatch(/\bV3Instrument\b/)
    expect(PAGE).toMatch(/encode="bar"/)
    expect(PAGE).toMatch(/formatPriceExact\(r\.medianPrice\)/)
    expect(PAGE).toMatch(/resortFigures\.get\(r\.slug\)\?\.activeCount/)
  })
})
