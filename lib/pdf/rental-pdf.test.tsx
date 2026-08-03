import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { analyzeRental } from '@/lib/rental-analysis'
import { RentalPdfDocument, type RentalPdfData } from './rental-pdf'

describe('RentalPdfDocument', () => {
  it('renders a valid PDF from a real analysis', async () => {
    const inputs = {
      purchasePrice: 650000,
      downPaymentPct: 25,
      interestRatePct: 7,
      loanTermYears: 30,
      grossRentMonthly: 3250,
      vacancyPct: 5,
      expenses: { propertyTaxes: 406, insurance: 117, propertyManagement: 260, maintenance: 163, capitalReserves: 163, hoa: 0 },
      projectionYears: [1, 2, 3, 5, 10, 20, 30],
    }
    const result = analyzeRental(inputs)
    const data: RentalPdfData = {
      propertyLabel: '123 Test St',
      purchasePrice: inputs.purchasePrice,
      downPaymentPct: inputs.downPaymentPct,
      interestRatePct: inputs.interestRatePct,
      loanTermYears: inputs.loanTermYears,
      grossRentMonthly: inputs.grossRentMonthly,
      result,
    }
    const doc = React.createElement(RentalPdfDocument, { data })
    type DocElement = Parameters<typeof renderToBuffer>[0]
    const buffer = await renderToBuffer(doc as DocElement)
    // A valid PDF starts with the "%PDF" magic bytes.
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  }, 30000)
})

describe('react-pdf surfaces obey THE PAGE CONTRACT', () => {
  it('the rental PDF keeps text out of every reserved band', async () => {
    const inputs = {
      purchasePrice: 650000,
      downPaymentPct: 25,
      interestRatePct: 7,
      loanTermYears: 30,
      grossRentMonthly: 3250,
      vacancyPct: 5,
      expenses: { propertyTaxes: 406, insurance: 117, propertyManagement: 260, maintenance: 163, capitalReserves: 163, hoa: 0 },
      projectionYears: [1, 2, 3, 5, 10, 20, 30],
    }
    const data: RentalPdfData = {
      propertyLabel: '123 Test St',
      purchasePrice: inputs.purchasePrice,
      downPaymentPct: inputs.downPaymentPct,
      interestRatePct: inputs.interestRatePct,
      loanTermYears: inputs.loanTermYears,
      grossRentMonthly: inputs.grossRentMonthly,
      result: analyzeRental(inputs),
    }
    const doc = React.createElement(RentalPdfDocument, { data })
    type DocElement = Parameters<typeof renderToBuffer>[0]
    const buffer = await renderToBuffer(doc as DocElement)
    const { inspectPdfPageSafety, formatViolations } = await import('./assert-page-safety')
    // react-pdf draws its own fixed footer inside the page, so STRADDLE has no
    // strips to classify. EDGE and SIDE are the rules that matter here.
    const report = await inspectPdfPageSafety(buffer, { runningMarksInBody: true })
    if (!report.ok) throw new Error(formatViolations(report.violations))
    expect(report.pageCount).toBeGreaterThan(0)
  }, 30000)
})
