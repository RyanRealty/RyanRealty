/**
 * report-scope — the Central Oregon claim may not sit over a statewide number.
 *
 * The fixture reproduces `buildReportHtml`'s exact markup (app/actions/
 * generate-market-report.ts) with the real cities that shipped in
 * /housing-market/reports/weekly-2026-05-24.
 */
import { describe, it, expect } from 'vitest'
import {
  REPORT_SCOPE_LABEL,
  isReportScopeCity,
  reportSectionCity,
  scopeReportCities,
  scopeReportHtml,
} from '@/lib/market/report-scope'

function section(city: string, closed: number, href = `/housing-market/${city.toLowerCase()}`): string {
  return `
      <section class="mt-8">
        <h2 class="text-xl font-semibold text-foreground"><a href="${href}" class="text-emerald-700 hover:text-emerald-800 hover:underline">${city}</a></h2>
        <p class="report-verdict mt-2 text-sm font-medium text-foreground">Seller's market with 3.2 months of supply.</p>
        <div class="mt-2 grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl border border-border bg-emerald-50/50 p-4">
            <h3 class="font-medium text-emerald-900">Closed (${closed})</h3>
            <ul class="mt-2 list-inside list-disc text-sm text-muted-foreground"><li>$625,000</li></ul></div></div></section>`
}

const INTRO = `
    <div class="market-report">
      <p class="report-dates text-muted-foreground text-sm">May 24, 2026 to May 30, 2026</p>
      <p class="report-intro text-muted-foreground mt-2">Here’s what happened in the Central Oregon real estate market last week, by city.</p>
  `

describe('report scope geography', () => {
  it('names the geography the report claims', () => {
    expect(REPORT_SCOPE_LABEL).toBe('Central Oregon')
  })

  it('accepts every city the weekly report is allowed to publish', () => {
    for (const city of [
      'Bend',
      'Redmond',
      'Sisters',
      'Sunriver',
      'La Pine',
      'Terrebonne',
      'Prineville',
      'Madras',
      'Powell Butte',
      'Culver',
      'Metolius',
      'Mitchell',
      'Camp Sherman',
      'Black Butte Ranch',
      'Crooked River Ranch',
    ]) {
      expect(isReportScopeCity(city), city).toBe(true)
    }
  })

  it('rejects the out-of-area cities that shipped on weekly-2026-05-24', () => {
    for (const city of [
      'Medford',
      'Grants Pass',
      'Klamath Falls',
      'Central Point',
      'Ashland',
      'Talent',
      'White City',
      'Albany',
      'Clackamas',
      'Portland',
      'Salem',
      'Eagle Point',
      'Jacksonville',
      'Cave Junction',
      'Shady Cove',
    ]) {
      expect(isReportScopeCity(city), city).toBe(false)
    }
  })

  it('rejects the unattributable bucket and empty values', () => {
    expect(isReportScopeCity('Other')).toBe(false)
    expect(isReportScopeCity('')).toBe(false)
    expect(isReportScopeCity(null)).toBe(false)
    expect(isReportScopeCity(undefined)).toBe(false)
  })
})

describe('scopeReportCities', () => {
  it('keeps Central Oregon rows and drops the rest', () => {
    const rows = [
      { city: 'Bend', closed: 69 },
      { city: 'Medford', closed: 43 },
      { city: 'Redmond', closed: 28 },
      { city: 'Grants Pass', closed: 17 },
      { city: 'Other', closed: 4 },
    ]
    expect(scopeReportCities(rows).map((r) => r.city)).toEqual(['Bend', 'Redmond'])
  })

  it('returns an empty list rather than an unscoped one', () => {
    expect(scopeReportCities([{ city: 'Medford' }, { city: 'Ashland' }])).toEqual([])
  })
})

describe('reportSectionCity', () => {
  it('reads the linked heading the generator writes', () => {
    expect(reportSectionCity(section('La Pine', 12))).toBe('La Pine')
  })

  it('reads an unlinked heading', () => {
    expect(reportSectionCity('<section><h2 class="x">Sisters</h2></section>')).toBe('Sisters')
  })

  it('decodes the generator escaping', () => {
    expect(reportSectionCity('<section><h2><a href="#">Bend &amp; Tumalo</a></h2></section>')).toBe(
      'Bend & Tumalo',
    )
  })

  it('returns null when the heading does not parse', () => {
    expect(reportSectionCity('<section><p>no heading</p></section>')).toBeNull()
  })
})

describe('scopeReportHtml', () => {
  const stored =
    INTRO +
    section('Bend', 69) +
    section('Medford', 43) +
    section('Redmond', 28) +
    section('Grants Pass', 17) +
    section('Klamath Falls', 14) +
    '</div>'

  it('drops every out-of-area section from a published body', () => {
    const scoped = scopeReportHtml(stored)
    expect(scoped.keptCities).toEqual(['Bend', 'Redmond'])
    expect(scoped.removedCities).toEqual(['Medford', 'Grants Pass', 'Klamath Falls'])
    expect(scoped.html).not.toContain('Medford')
    expect(scoped.html).not.toContain('Grants Pass')
    expect(scoped.html).not.toContain('Klamath Falls')
    expect(scoped.html).toContain('Bend')
    expect(scoped.html).toContain('Redmond')
  })

  it('keeps the Central Oregon figures intact', () => {
    const scoped = scopeReportHtml(stored)
    expect(scoped.html).toContain('Closed (69)')
    expect(scoped.html).toContain('Closed (28)')
    expect(scoped.html).not.toContain('Closed (43)')
    expect(scoped.html).toContain('Here’s what happened in the Central Oregon real estate market')
  })

  it('is idempotent — a scoped body comes back byte-identical', () => {
    const once = scopeReportHtml(stored).html
    const twice = scopeReportHtml(once)
    expect(twice.html).toBe(once)
    expect(twice.removedCities).toEqual([])
  })

  it('leaves an already-in-scope body untouched', () => {
    const clean = INTRO + section('Bend', 69) + section('Sunriver', 3) + '</div>'
    const scoped = scopeReportHtml(clean)
    expect(scoped.html).toBe(clean)
    expect(scoped.removedCities).toEqual([])
    expect(scoped.keptCities).toEqual(['Bend', 'Sunriver'])
  })

  it('keeps a section it cannot attribute and counts it', () => {
    const odd = INTRO + '<section class="mt-8"><p>no heading</p></section>' + section('Medford', 43) + '</div>'
    const scoped = scopeReportHtml(odd)
    expect(scoped.unresolvedSections).toBe(1)
    expect(scoped.html).toContain('no heading')
    expect(scoped.removedCities).toEqual(['Medford'])
  })

  it('handles a null or empty body', () => {
    expect(scopeReportHtml(null).html).toBe('')
    expect(scopeReportHtml(undefined).removedCities).toEqual([])
    expect(scopeReportHtml('').keptCities).toEqual([])
  })
})
