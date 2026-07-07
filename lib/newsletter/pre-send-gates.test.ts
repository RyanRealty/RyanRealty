import { describe, it, expect } from 'vitest'
import { checkCitations, extractInternalLinks, checkInternalLinks } from './pre-send-gates'
import type { NewsletterCitationEntry } from '@/lib/data/newsletter'

const cite = (value: string | number, figure = 'fig'): NewsletterCitationEntry => ({
  figure,
  source: 'test',
  filter: 'test',
  value,
  fetched_at: new Date().toISOString(),
})

describe('R-2 checkCitations', () => {
  it('passes when every stat token has a citation', () => {
    const body = `<p>The median home in Bend closed at $739,000.</p>
      <div>16 homes for sale inside the gates</div>
      <span>SELLER'S</span>`
    const r = checkCitations(body, [cite(739450), cite(16), cite('sellers')])
    expect(r.ok).toBe(true)
    expect(r.failures).toEqual([])
    expect(r.checked).toBeGreaterThanOrEqual(3)
  })

  it('matches currency against the citation value rounded to the nearest thousand', () => {
    const r = checkCitations('<p>closed at $740,000</p>', [cite(739750)])
    expect(r.ok).toBe(true)
  })

  it('fails a currency figure with no citation', () => {
    const r = checkCitations('<p>closed at $999,000</p>', [cite(500000)])
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toContain('$999,000')
  })

  it('fails an inventory count with no citation', () => {
    const r = checkCitations('<p>42 homes for sale in Tetherow</p>', [])
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toContain('42 homes for sale')
  })

  it('fails a verdict pill with no verdict citation', () => {
    const r = checkCitations(`<b>BUYER'S</b>`, [cite('sellers')])
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toContain("BUYER'S")
  })

  it('checks day counts and months of supply with a small tolerance', () => {
    const ok = checkCitations('<p>pending in 19 days, 4.3 months of supply</p>', [cite(19), cite(4.32)])
    expect(ok.ok).toBe(true)
    const bad = checkCitations('<p>pending in 19 days</p>', [cite(30)])
    expect(bad.ok).toBe(false)
  })

  it('ignores prose numerals, event dates, and phone digits', () => {
    const body = `<p>Across the 6 cities we cover, no two are the same market.</p>
      <div>JUN 4-8 · BEND</div>
      <a href="tel:5412136706">541.213.6706</a>`
    const r = checkCitations(body, [])
    expect(r.ok).toBe(true)
  })

  it('passes an empty body with no citations (nothing to cite)', () => {
    expect(checkCitations('', []).ok).toBe(true)
  })

  it('excludes data-nl-quote blocks (verbatim excerpts of published pages)', () => {
    const body = `<div data-nl-quote="blog">Bend closed May at a $797,000 median, up 3.6% year over year.</div>
      <p>The median home in Bend closed at $725,000.</p>`
    const failing = checkCitations(body, [])
    expect(failing.failures).toEqual(['No citation for "$725,000" (currency figure)'])
    const passing = checkCitations(body, [cite(725000)])
    expect(passing.ok).toBe(true)
  })
})

describe('R-3 extractInternalLinks', () => {
  it('extracts deduped internal links and skips compliance + external links', () => {
    const body = `
      <a href="https://ryan-realty.com/buy">a</a>
      <a href="https://ryan-realty.com/buy">dup</a>
      <a href="https://ryan-realty.com/cities/bend/market-report">b</a>
      <a href="https://ryan-realty.com/newsletter/unsubscribe?token=x">unsub</a>
      <a href="https://example.com/elsewhere">ext</a>`
    const links = extractInternalLinks(body)
    expect(links).toEqual([
      'https://ryan-realty.com/buy',
      'https://ryan-realty.com/cities/bend/market-report',
    ])
  })
})

describe('R-3 checkInternalLinks', () => {
  it('passes when every link returns 200 and fails on a 404', async () => {
    const statuses: Record<string, number> = {
      'https://ryan-realty.com/buy': 200,
      'https://ryan-realty.com/gone': 404,
    }
    const fetchImpl = async (url: string) => ({ status: statuses[url] ?? 200 })
    const body = '<a href="https://ryan-realty.com/buy">a</a><a href="https://ryan-realty.com/gone">b</a>'
    const r = await checkInternalLinks(body, fetchImpl)
    expect(r.ok).toBe(false)
    expect(r.checked).toBe(2)
    expect(r.failures).toEqual(['https://ryan-realty.com/gone returned HTTP 404'])
  })

  it('reports a link that does not respond', async () => {
    const fetchImpl = async () => {
      throw new Error('network down')
    }
    const r = await checkInternalLinks('<a href="https://ryan-realty.com/buy">a</a>', fetchImpl)
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toContain('did not respond')
  })
})
