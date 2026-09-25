import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { PlaceSchool } from '@/lib/data'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { neighborhoodMarketFaqInput } from '../neighborhood-market'
import {
  dailyLifeRows,
  dailyLifeSection,
  NEIGHBORHOOD_DAILY_PARKS_TRACE,
  NEIGHBORHOOD_SCHOOLS_TRACE,
} from './neighborhood-daily-life'

/**
 * Matt 2026-09-24: neighborhood pages answer schools. The Schools section and
 * the FAQ answer both read the Deschutes County attendance areas, because the
 * authored school names disagreed with the county in three of thirteen
 * neighborhoods (Southeast Bend's page named Lava Ridge Elementary; its
 * attendance areas are R E Jewell and Silver Rail, measured 2026-09-25).
 */

const SOUTHEAST_BEND: PlaceSchool[] = [
  { slug: 'r-e-jewell-elem', name: 'R E Jewell Elem', level: 'elementary', share: 0.901 },
  { slug: 'silver-rail-elem', name: 'Silver Rail Elem', level: 'elementary', share: 0.097 },
  { slug: 'high-desert-middle', name: 'High Desert Middle', level: 'middle', share: 0.998 },
  { slug: 'caldera-high', name: 'Caldera High', level: 'high', share: 1 },
]

const AUTHORED = {
  amenities: [
    { category: 'Schools', name: 'Lava Ridge Elementary', description: 'Serving the southeast quadrant.', access: 'Bend-La Pine Schools' },
    { category: 'Parks', name: 'Drake Park', description: '', access: 'Walkable' },
  ],
} as unknown as ResortCommunityContent

describe('neighborhood Schools section', () => {
  it('lists the attendance schools in order, never the authored school names', () => {
    const { schools, parks } = dailyLifeRows(AUTHORED, 'Bend', SOUTHEAST_BEND)
    expect(schools.map((row) => row.href)).toEqual([
      '/schools/r-e-jewell-elem',
      '/schools/silver-rail-elem',
      '/schools/high-desert-middle',
      '/schools/caldera-high',
    ])
    expect(JSON.stringify(schools)).toContain('Middle school')
    expect(JSON.stringify([...schools, ...parks])).not.toContain('Lava Ridge')
    expect(parks.map((row) => row.href)).toEqual(['/parks/drake-park'])
  })

  it('names both kinds of row in the heading and the source line when parks ride along', () => {
    const section = dailyLifeSection(dailyLifeRows(AUTHORED, 'Bend', SOUTHEAST_BEND))
    expect(section?.heading).toBe('Schools and parks')
    expect(section?.source).toBe(`${NEIGHBORHOOD_SCHOOLS_TRACE} ${NEIGHBORHOOD_DAILY_PARKS_TRACE}`)
    expect(section?.rows.map((row) => row.href).slice(-1)).toEqual(['/parks/drake-park'])
    const schoolsOnly = dailyLifeSection(dailyLifeRows(null, 'Bend', SOUTHEAST_BEND))
    expect(schoolsOnly?.heading).toBe('Schools')
    expect(schoolsOnly?.source).toBe(NEIGHBORHOOD_SCHOOLS_TRACE)
  })

  it('renders no section without schools, so the parks go to the Parks section', () => {
    expect(dailyLifeSection(dailyLifeRows(AUTHORED, 'Bend', []))).toBeNull()
  })
})

describe('neighborhood schools FAQ', () => {
  it('names the district and every attendance area, the same list the section prints', () => {
    const r = buildMarketFaq(
      'Southeast Bend',
      neighborhoodMarketFaqInput({
        published: { activeCount: null, medianListPrice: null },
        monthsOfSupply: null,
        medianDaysToPending: null,
        soldCount12mo: null,
        refreshedAt: null,
        attendanceSchools: SOUTHEAST_BEND.map((school) => school.name),
        schoolDistrict: { district: 'Bend-La Pine Schools', districtSlug: 'bend-la-pine' },
      }),
    )
    const school = r.faqs.find((f) => f.question === 'What school district serves Southeast Bend?')
    expect(school?.answer).toBe(
      'Bend-La Pine Schools. Attendance areas covering Southeast Bend are R E Jewell Elem, Silver Rail Elem, High Desert Middle, and Caldera High.',
    )
    // Schools are not a Dataset variable.
    expect(r.datasetVariables.map((v) => v.name).join(' ')).not.toMatch(/school/i)
  })

  it('asks nothing about schools when the attendance read came back empty', () => {
    const r = buildMarketFaq(
      'Southeast Bend',
      neighborhoodMarketFaqInput({
        published: { activeCount: null, medianListPrice: null },
        monthsOfSupply: null,
        medianDaysToPending: null,
        soldCount12mo: null,
        refreshedAt: null,
        attendanceSchools: [],
        schoolDistrict: { district: 'Bend-La Pine Schools', districtSlug: 'bend-la-pine' },
      }),
    )
    expect(r.faqs.find((f) => /school/i.test(f.question))).toBeUndefined()
  })

  it('feeds the section and the FAQ from the one attendance read on the page', () => {
    const src = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
    expect(src).toMatch(/getPlaceSchools\('neighborhood', boundaryNeighborhoodSlug\)/)
    expect(src).toMatch(/dailyLifeRows\(richContent, cityName, placeSchools\)/)
    expect(src).toMatch(/attendanceSchools: placeSchools\.map\(\(school\) => school\.name\)/)
    expect(src).toMatch(/character: placeCharacter,/)
    expect(src).toMatch(/documents: placeDocuments,/)
  })
})
