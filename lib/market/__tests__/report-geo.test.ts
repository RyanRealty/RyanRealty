import { describe, it, expect } from 'vitest'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { resolveReportCommunity, reportCommunitiesInCity } from '../report-geo'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/lib/data/geo/report-cities'

type Entry = { slug: string; label: string; city: string; city_slug: string }
const COMMUNITIES = resortRegistry.communities as Entry[]

describe('resolveReportCommunity — the city must actually scope the document', () => {
  it('refuses a real community under the WRONG city', () => {
    // The live defect: `?city=Madras&subdivision=Tetherow` returned a branded
    // workbook titled "Tetherow, Madras" carrying Bend's Tetherow numbers,
    // because the cache keys a community by a BARE slug and the city was only
    // ever used in the title.
    expect(resolveReportCommunity('Madras', 'Tetherow')).toBeNull()
    expect(resolveReportCommunity('Bend', 'Black Butte Ranch')).toBeNull()
    expect(resolveReportCommunity('Redmond', 'Sunriver')).toBeNull()
  })

  it('resolves every registry community under its OWN city and no other', () => {
    for (const c of COMMUNITIES) {
      expect(resolveReportCommunity(c.city, c.label), `${c.label} in ${c.city}`).toMatchObject({
        slug: c.slug,
        city: c.city,
      })
      for (const other of MARKET_REPORT_DEFAULT_CITIES) {
        if (other.toLowerCase() === c.city.toLowerCase()) continue
        expect(
          resolveReportCommunity(other, c.label),
          `${c.label} must NOT resolve under ${other}`,
        ).toBeNull()
      }
    }
  })

  it('accepts the slug or the label, case- and punctuation-insensitively', () => {
    expect(resolveReportCommunity('Sisters', 'black-butte-ranch')?.slug).toBe('black-butte-ranch')
    expect(resolveReportCommunity('sisters', 'BLACK BUTTE RANCH')?.slug).toBe('black-butte-ranch')
    expect(resolveReportCommunity('Sisters', '  Black   Butte  Ranch ')?.slug).toBe('black-butte-ranch')
  })

  it('refuses anything the registry does not carry — no name-only fallback', () => {
    expect(resolveReportCommunity('Bend', 'Nowhere Estates')).toBeNull()
    expect(resolveReportCommunity('Bend', '')).toBeNull()
    expect(resolveReportCommunity('Bend', '   ')).toBeNull()
    // slugify('***') is the literal 'unknown', not '' — the blank guard must read
    // the RAW input or punctuation-only input slips through as a real slug.
    expect(resolveReportCommunity('Bend', '***')).toBeNull()
    // A subdivision that exists as a bare cache slug but is NOT registry-placed.
    expect(resolveReportCommunity('Bend', 'Deer Park')).toBeNull()
  })

  it('refuses every community when the city itself is unknown', () => {
    for (const c of COMMUNITIES.slice(0, 5)) {
      expect(resolveReportCommunity('Central Point', c.label)).toBeNull()
    }
  })
})

describe('reportCommunitiesInCity', () => {
  it('lists only that city’s communities, alphabetically', () => {
    const bend = reportCommunitiesInCity('Bend')
    expect(bend.length).toBeGreaterThan(0)
    expect(bend.every((c) => c.city === 'Bend')).toBe(true)
    expect(bend.map((c) => c.label)).toEqual([...bend.map((c) => c.label)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
  })

  it('returns empty for a city with no registered communities', () => {
    expect(reportCommunitiesInCity('Madras')).toEqual([])
  })

  it('places every registry community inside a city the report engine covers', () => {
    // A community whose city is outside MARKET_REPORT_DEFAULT_CITIES could never
    // be exported (the city check rejects first), which would be a silent hole.
    const covered = new Set(MARKET_REPORT_DEFAULT_CITIES.map((c) => c.toLowerCase()))
    for (const c of COMMUNITIES) {
      expect(covered.has(c.city.toLowerCase()), `${c.label} sits in uncovered city ${c.city}`).toBe(true)
    }
  })
})
