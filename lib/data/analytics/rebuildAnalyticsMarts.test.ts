import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  analyticsClosedCityLabels,
  buildOfficeDimIndex,
  isMlsNoOffice,
  PERMANENT_ZERO_MLS_CITY_LABELS,
  resolveOfficeId,
} from '@/lib/data/analytics/rebuildAnalyticsMarts'

describe('rebuildAnalyticsMarts helpers', () => {
  it('drops Tumalo and Crooked River Ranch from the closed-city IN list', () => {
    const labels = analyticsClosedCityLabels()
    expect(PERMANENT_ZERO_MLS_CITY_LABELS).toEqual(['Tumalo', 'Crooked River Ranch'])
    expect(labels).not.toContain('Tumalo')
    expect(labels).not.toContain('Crooked River Ranch')
    expect(labels).toContain('Bend')
    expect(labels).toContain('La Pine')
    expect(labels).toContain('Crooked River')
  })

  it('resolves office_id from canonical or alias and skips No Office', () => {
    expect(isMlsNoOffice('No Office')).toBe(true)
    expect(isMlsNoOffice('Ryan Realty')).toBe(false)
    const index = buildOfficeDimIndex([
      {
        office_id: 'oid-1',
        canonical_name: 'Ryan Realty',
        aliases: ['Ryan Realty Group', 'Ryan Realty Bend'],
      },
    ])
    expect(resolveOfficeId('Ryan Realty', index)).toBe('oid-1')
    expect(resolveOfficeId('ryan  realty  group', index)).toBe('oid-1')
    expect(resolveOfficeId('No Office', index)).toBeNull()
    expect(resolveOfficeId('Unknown Brokerage LLC', index)).toBeNull()
  })

  it('sale-pricing-facts recency tags untagged Actives', () => {
    const src = readFileSync(resolve('app/api/cron/refresh-sale-pricing-facts/route.ts'), 'utf8')
    expect(src).toMatch(/refresh_listing_boundary_tags/)
  })

  it('cron rebuilds in-process — spawn cannot see scripts/ on Vercel', () => {
    const nightly = readFileSync(resolve('app/api/cron/rebuild-analytics-marts/route.ts'), 'utf8')
    const weekly = readFileSync(resolve('app/api/cron/rebuild-analytics-marts-full/route.ts'), 'utf8')
    expect(nightly).toMatch(/rebuildAnalyticsMarts/)
    expect(weekly).toMatch(/rebuildAnalyticsMarts/)
    expect(nightly).not.toMatch(/\bspawn\b/)
    expect(weekly).not.toMatch(/\bspawn\b/)
  })
})
