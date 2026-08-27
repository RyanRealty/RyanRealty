import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}))

import { SubdivisionSalesHistory } from '../SubdivisionSalesHistory'

const SRC = resolve('app/subdivisions/[slug]/SubdivisionSalesHistory.tsx')
const PAGE = resolve('app/subdivisions/[slug]/page.tsx')

const HISTORY = [
  { year: 2024, closedCount: 3, medianClosePrice: 317_000 },
  { year: 2023, closedCount: 2, medianClosePrice: 287_500 },
  { year: 1997, closedCount: 1, medianClosePrice: 142_000 },
]

function renderHistory() {
  return renderToStaticMarkup(
    createElement(SubdivisionSalesHistory, {
      displayName: 'Kitty Hawk',
      history: HISTORY,
      cityName: 'Sunriver',
    }),
  )
}

/**
 * The grain rules this section has always carried, asserted against the v3
 * Ledger instead of the KB table it replaced on 2026-08-26. Every rule below
 * is the same rule; only the spelling of what renders it moved.
 */
describe('subdivision yearly history grain', () => {
  it('labels the rows as MLS plat-name closed counts, not recorded plat', () => {
    const html = renderHistory()
    expect(html).toContain('MLS plat name')
    expect(html).toMatch(/single-family name join/i)
    expect(html).toMatch(/not recorded-plat membership/i)
    expect(html).toContain('>2024<')
    expect(html).toMatch(/closings/i)
  })

  it('publishes counts only — no closed price at plat grain (REGISTRY §4)', () => {
    const html = renderHistory()
    // The founding rule: 515 of 680 Bend plats never reach ten detached sales in
    // 36 months, so a median of this join is not a fact and never renders.
    expect(html).not.toContain('$')
    expect(html).not.toMatch(/median close/i)
    expect(html).not.toMatch(/months of supply/i)
    expect(html).toMatch(/counts only/i)
    // 317,000 and 287,500 are in the fixture and must not reach the markup in
    // any formatting.
    expect(html).not.toContain('317')
    expect(html).not.toContain('287')
  })

  it('reads the withholding from the publisher rather than assuming it', () => {
    const src = readFileSync(SRC, 'utf8')
    expect(src).toMatch(/publishSubdivisionClosedPrice/)
    expect(src).toMatch(/priceMayPublish/)
    // The raw column may not be formatted anywhere in this file.
    expect(src).not.toMatch(/formatPrice\(/)
    expect(src).not.toMatch(/Median close price/)
    expect(src).not.toMatch(/stats\.soldCount/)
  })

  it('keeps the cache soldCount off the plat market band', () => {
    // The rule moved from subdivisionCacheStatCells to platStatsFigures when the
    // route joined the barrel: cache soldCount is YTD MLS-name closings, not
    // recorded-plat 12-month membership closed_count, so it may not sit beside
    // figures that are.
    const figures = readFileSync(
      resolve('app/subdivisions/[slug]/_v3/subdivision-figures.ts'),
      'utf8',
    )
    expect(figures).toMatch(/publishSubdivisionClosedPrice/)
    expect(figures).not.toMatch(/stats\.soldCount/)
    expect(figures).not.toMatch(/homes sold/i)
  })

  it('never fills the plat band from a parent geography', () => {
    // ci:publish-plat-figures says the same thing; this asserts it at the page.
    // Code, not prose: the page's header names the deleted helper on purpose.
    const page = readFileSync(PAGE, 'utf8')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(page).toMatch(/publishPlatFigures\(/)
    expect(page).not.toMatch(/fetchSubdivMarketExtras/)
    expect(page).not.toMatch(/cityPulse/)
    expect(page).not.toMatch(/communityPulse/)
  })
})
