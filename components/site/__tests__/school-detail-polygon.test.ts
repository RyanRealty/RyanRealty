import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CO_PARKS } from '@/data/co-parks'

const SCHOOL_PAGE = readFileSync(new URL('../../../app/schools/[slug]/page.tsx', import.meta.url), 'utf8')

describe('SITE-67 remainder polygons', () => {
  it('school pages do not draw a city polygon as the attendance area', () => {
    expect(SCHOOL_PAGE).toMatch(/geoType:\s*'school'/)
    expect(SCHOOL_PAGE).not.toMatch(/geoType:\s*'city'/)
    expect(SCHOOL_PAGE).toMatch(/const polygon = schoolBoundary/)
    expect(SCHOOL_PAGE).toMatch(/not a city stand-in/)
  })

  it('american-legion-park has no invented polygon', () => {
    const park = CO_PARKS.find((p) => p.slug === 'american-legion-park')
    expect(park?.hasPolygon).toBe(false)
  })
})
