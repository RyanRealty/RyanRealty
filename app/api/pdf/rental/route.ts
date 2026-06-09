import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { analyzeRental, type RentalAnalysisInputs } from '@/lib/rental-analysis'
import { RentalPdfDocument, type RentalPdfData } from '@/lib/pdf/rental-pdf'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Branded rental-analysis PDF. The client POSTs the calculator inputs; we
 * RE-COMPUTE the analysis server-side via analyzeRental (CLAUDE.md §0 — never
 * trust the client's numbers) and render the same verified engine output.
 */

/** Coerce to a finite number within [min,max], else fall back. */
function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const purchasePrice = num(body.purchasePrice, 0, 100_000_000, 0)
  if (purchasePrice <= 0) {
    return NextResponse.json({ error: 'A purchase price is required' }, { status: 400 })
  }
  const grossRentMonthly = num(body.grossRentMonthly, 0, 1_000_000, 0)
  const e = (body.expenses ?? {}) as Record<string, unknown>

  const inputs: RentalAnalysisInputs = {
    purchasePrice,
    downPaymentPct: num(body.downPaymentPct, 0, 100, 25),
    interestRatePct: num(body.interestRatePct, 0, 25, 7),
    loanTermYears: num(body.loanTermYears, 1, 40, 30),
    rehabCost: num(body.rehabCost, 0, 10_000_000, 0),
    grossRentMonthly,
    vacancyPct: num(body.vacancyPct, 0, 100, 5),
    expenses: {
      propertyTaxes: num(e.propertyTaxes, 0, 1_000_000, 0),
      insurance: num(e.insurance, 0, 1_000_000, 0),
      propertyManagement: num(e.propertyManagement, 0, 1_000_000, 0),
      maintenance: num(e.maintenance, 0, 1_000_000, 0),
      capitalReserves: num(e.capitalReserves, 0, 1_000_000, 0),
      hoa: num(e.hoa, 0, 1_000_000, 0),
    },
    appreciationPct: num(body.appreciationPct, -20, 50, 3),
    rentGrowthPct: num(body.rentGrowthPct, -20, 50, 2),
    expenseGrowthPct: num(body.expenseGrowthPct, -20, 50, 2),
    projectionYears: [1, 2, 3, 5, 10, 20, 30],
  }

  const result = analyzeRental(inputs)
  const labelRaw = typeof body.propertyLabel === 'string' ? body.propertyLabel.trim().slice(0, 120) : null

  const data: RentalPdfData = {
    propertyLabel: labelRaw || null,
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
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ryan-realty-rental-analysis.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
