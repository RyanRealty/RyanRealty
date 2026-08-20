/**
 * The legacy per-geo report hop must pick the same destination the deleted page
 * body picked (app/reports/[slug]/[geoName]/page.tsx):
 *
 *   slug === 'city'  ->  permanentRedirect(`/housing-market/${slugify(name)}`)
 *   otherwise        ->  permanentRedirect('/housing-market/reports')
 *
 * ...and must not touch the live routes that share the prefix.
 */

import { describe, it, expect } from 'vitest'
import { resolveLegacyReportGeoRedirect } from './legacy-report-geo'

describe('resolveLegacyReportGeoRedirect', () => {
  it('sends a city report to the live market page for that city', () => {
    expect(resolveLegacyReportGeoRedirect('/reports/city/Bend')).toBe('/housing-market/bend')
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports/city/Bend')).toBe('/housing-market/bend')
  })

  it('slugifies a multi-word or encoded geo name', () => {
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports/city/La%20Pine')).toBe('/housing-market/la-pine')
    expect(resolveLegacyReportGeoRedirect('/reports/city/Black%20Butte%20Ranch')).toBe(
      '/housing-market/black-butte-ranch',
    )
  })

  it('tolerates a trailing slash', () => {
    expect(resolveLegacyReportGeoRedirect('/reports/city/Redmond/')).toBe('/housing-market/redmond')
  })

  it('sends every non-city geo to the live reports hub', () => {
    expect(resolveLegacyReportGeoRedirect('/reports/community/Tetherow')).toBe('/housing-market/reports')
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports/neighborhood/Awbrey%20Butte')).toBe(
      '/housing-market/reports',
    )
  })

  it('leaves the live routes that share the prefix alone', () => {
    // app/housing-market/reports/archive/[city]/page.tsx
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports/archive/bend')).toBeNull()
    // app/reports/sales/[city]/[period]/page.tsx
    expect(resolveLegacyReportGeoRedirect('/reports/sales/bend')).toBeNull()
    expect(resolveLegacyReportGeoRedirect('/reports/sales/bend/2026')).toBeNull()
    // the single-segment weekly report, which renders
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports/weekly-2026-05-24')).toBeNull()
    expect(resolveLegacyReportGeoRedirect('/housing-market/reports')).toBeNull()
    expect(resolveLegacyReportGeoRedirect('/housing-market/bend')).toBeNull()
    expect(resolveLegacyReportGeoRedirect('/communities/tetherow')).toBeNull()
  })

  it('never emits an empty geo segment', () => {
    // slugify falls back to 'unknown' on a name with no usable characters; the
    // hub is a better destination than a guaranteed 404.
    expect(resolveLegacyReportGeoRedirect('/reports/city/%2F%2F')).toBe('/housing-market/reports')
  })
})
