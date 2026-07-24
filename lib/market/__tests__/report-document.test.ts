import { describe, it, expect } from 'vitest'
import {
  NA,
  buildSections,
  buildDocumentFilename,
  liveHeading,
  windowText,
  type ReportDocumentFacts,
} from '../report-document'

/**
 * The shape that produced the defect: a 30-day chosen period, a 12-month
 * trailing count, and a live months-of-supply figure that describes neither.
 * Terrebonne shipped "21 months of supply" under a "Last 30 days" header.
 */
const facts: ReportDocumentFacts = {
  period: { label: 'Last 30 days', start: '2026-06-24', end: '2026-07-24' },
  medianSalePrice: 709000,
  soldCount: 2,
  medianDom: 38,
  medianPricePerSqft: 312,
  trailing12: { label: 'Last 12 months', start: '2025-07-24', end: '2026-07-24' },
  sales12mo: 61,
  activeCount: 107,
  monthsOfSupply: 21,
  liveAsOf: '2026-07-24',
  trend: [
    { month: '2026-05', soldCount: 4, medianSalePrice: 640000 },
    { month: '2026-06', soldCount: 6, medianSalePrice: 655000 },
  ],
}

const headingOf = (label: string, sections: ReturnType<typeof buildSections>) =>
  sections.find((s) => s.rows.some(([k]) => k === label))?.heading

describe('buildSections — every figure states its own window', () => {
  const sections = buildSections(facts, null)

  it('puts each figure inside exactly one headed block', () => {
    const all = sections.flatMap((s) => s.rows.map(([k]) => k))
    expect(new Set(all).size).toBe(all.length)
    expect(sections.every((s) => s.heading.trim().length > 0)).toBe(true)
  })

  it('does not label the 12-month count with the chosen period’s window', () => {
    const chosen = headingOf('Sold Count', sections)
    const trailing = headingOf('12 Month Sales', sections)
    expect(chosen).toContain('2026-06-24 to 2026-07-24')
    expect(trailing).toContain('2025-07-24 to 2026-07-24')
    expect(trailing).not.toBe(chosen)
  })

  it('labels live inventory as live, with its refresh date — not as the period', () => {
    const live = headingOf('Months of Supply', sections)
    expect(live).toBe('Live single-family inventory (as of 2026-07-24)')
    expect(headingOf('Active Listings', sections)).toBe(live)
    // The bug: months of supply reading as if measured over the chosen window.
    expect(live).not.toContain('Last 30 days')
    expect(live).not.toContain('2026-06-24')
  })

  it('says so out loud when the live snapshot has no refresh time', () => {
    expect(liveHeading({ ...facts, liveAsOf: null })).toBe(
      'Live single-family inventory (refresh time unavailable)',
    )
  })

  it('reports a missing figure as unavailable, never as 0', () => {
    const empty = buildSections(
      { ...facts, medianSalePrice: null, soldCount: null, monthsOfSupply: null, activeCount: null, sales12mo: null, trend: [] },
      null,
    )
    const values = empty.flatMap((s) => s.rows.map(([, v]) => v))
    expect(values.filter((v) => v === NA).length).toBeGreaterThanOrEqual(6)
    expect(values).not.toContain(0)
  })

  it('states the narrative is unavailable rather than omitting the block', () => {
    expect(headingOf('Narrative', sections)).toBe('Narrative')
    expect(buildSections(facts, null).at(-1)?.rows[0]?.[1]).toBe('Narrative not available yet.')
    expect(buildSections(facts, 'Inventory rose.').at(-1)?.rows[0]?.[1]).toBe('Inventory rose.')
  })
})

describe('windowText', () => {
  it('prints the measured row’s own bounds', () => {
    expect(windowText({ label: 'Year to date', start: '2026-01-01', end: '2026-07-24' })).toBe(
      'Year to date (2026-01-01 to 2026-07-24)',
    )
  })

  it('never invents dates it does not have', () => {
    expect(windowText({ label: 'Year to date', start: null, end: null })).toBe('Year to date')
    expect(windowText({ label: 'Year to date', start: '2026-01-01', end: null })).toBe('Year to date')
  })
})

describe('buildDocumentFilename', () => {
  it('carries the geo and the real window, so two windows never collide', () => {
    expect(buildDocumentFilename('Bend-Tetherow', facts.period)).toBe(
      'market-report-bend-tetherow-2026-06-24-to-2026-07-24',
    )
    expect(buildDocumentFilename('Bend', { label: 'Year to date', start: null, end: null })).toBe(
      'market-report-bend-year-to-date',
    )
  })
})
