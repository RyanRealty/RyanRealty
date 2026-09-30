import { describe, expect, it } from 'vitest'
import { continuationFormFor, continuedMarker, fromLead, layoutWithMarker, planContinuationPages, sectionName } from './continuation'
import { helveticaWidth, usableWidth } from './text-areas'

const SIZE = 8.5
const lines = (n: number, widthPts = 514) => Array.from({ length: n }, () => ({ widthPts }))
const words = (n: number, tag = 'w') => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ')

describe('which addendum, and what it says', () => {
  it("uses the form's own set: the 2.2 General Addendum for the OR set, OREF 002 otherwise", () => {
    expect(continuationFormFor('OR')).toMatchObject({ formNumber: '2.2', title: 'General Addendum' })
    expect(continuationFormFor('OREF')).toMatchObject({ formNumber: '002', title: 'Addendum' })
    expect(continuationFormFor(null).formNumber).toBe('002')
  })

  it("names the section by its printed title, never by a widget name", () => {
    expect(sectionName('28 ADDITIONAL PROVISIONS describe')).toBe('Additional Provisions')
    expect(sectionName('8 ADDITIONAL FINANCING PROVISIONS')).toBe('Additional Financing Provisions')
    expect(sectionName('13 The Parties agree as follows')).toBe('The Parties Agree as Follows')
    expect(sectionName('Identify Invasive Inspections_2')).toBe('Identify Invasive Inspections')
    expect(sectionName('Public Remarks.0.1')).toBe('Public Remarks')
    expect(sectionName('Text7.0')).toBeNull()
    expect(sectionName('311')).toBeNull()
    expect(sectionName(null)).toBeNull()
  })

  it('writes the markers SkySlope writes, with the addendum number', () => {
    expect(continuedMarker(continuationFormFor('OREF'), 3, '1')).toBe('(Continued: Addendum No. 3, paragraph 1)')
    expect(fromLead('1.2', { formName: 'Residential Real Estate Sale Agreement - 001 OREF', page: 9, section: 'Additional Provisions' })).toBe(
      '1.2. (From: Residential Real Estate Sale Agreement - 001 OREF, Page 9, Additional Provisions) ...',
    )
  })
})

describe('the source section', () => {
  it('ends its last line with the marker and hands on every word it could not hold', () => {
    const marker = '(Continued: Addendum No. 3, paragraph 1)'
    const text = words(120)
    const r = layoutWithMarker(text, lines(3), SIZE, marker)
    expect(r.lines[2].endsWith(marker)).toBe(true)
    expect(helveticaWidth(r.lines[2], SIZE)).toBeLessThanOrEqual(usableWidth(514) + 0.001)
    const placed = r.lines.join(' ').replace(marker, '').trim().split(/\s+/)
    expect([...placed, ...r.overflow.split(' ')]).toEqual(text.split(' '))
  })

  it('adds no marker when the text fits', () => {
    const r = layoutWithMarker('Seller to leave the washer and dryer.', lines(3), SIZE, '(Continued: Addendum No. 3, paragraph 1)')
    expect(r.overflow).toBe('')
    expect(r.lines.join(' ')).not.toMatch(/Continued/)
  })
})

describe('the addendum pages', () => {
  const form = continuationFormFor('OREF')
  const source = (key: string, text: string) => ({ key, formName: 'Residential Real Estate Sale Agreement - 001 OREF', page: 9, section: 'Additional Provisions', text })

  it('opens each paragraph with where it came from and fits a short overflow on one addendum', () => {
    const plan = planContinuationPages([source('a', 'Seller to repair the furnace.'), source('b', 'Buyer to keep the shed.')], { form, firstNumber: 3, body: lines(20), size: SIZE })
    expect(plan.pages).toHaveLength(1)
    expect(plan.pages[0].addendumNumber).toBe(3)
    expect(plan.pages[0].lines[0]).toBe('1. (From: Residential Real Estate Sale Agreement - 001 OREF, Page 9, Additional Provisions) ...Seller to repair the furnace.')
    expect(plan.pages[0].lines[1]).toBe('2. (From: Residential Real Estate Sale Agreement - 001 OREF, Page 9, Additional Provisions) ...Buyer to keep the shed.')
    expect(plan.starts).toEqual({ a: { addendumNumber: 3, paragraph: '1' }, b: { addendumNumber: 3, paragraph: '2' } })
  })

  it('chains onto the next addendum as paragraph 1.2 with a marker, losing no word', () => {
    const text = words(900)
    const plan = planContinuationPages([source('a', text)], { form, firstNumber: 3, body: lines(20), size: SIZE })
    expect(plan.pages.length).toBeGreaterThan(1)
    expect(plan.pages.map((p) => p.addendumNumber)).toEqual(plan.pages.map((_, i) => 3 + i))
    expect(plan.pages[0].lines[19].endsWith('(Continued: Addendum No. 4, paragraph 1.2)')).toBe(true)
    expect(plan.pages[1].lines[0].startsWith('1.2. (From: Residential Real Estate Sale Agreement - 001 OREF, Page 9, Additional Provisions) ...')).toBe(true)
    // Every word comes through once, in order.
    const all = plan.pages
      .flatMap((p) => p.lines)
      .join(' ')
      .replace(/\(Continued: [^)]*\)/g, ' ')
      .replace(/\d+(\.\d+)?\. \(From: [^)]*\) \.\.\./g, ' ')
      .split(/\s+/)
      .filter(Boolean)
    expect(all).toEqual(text.split(' '))
  })

  it('starts a later paragraph on the addendum where it actually lands', () => {
    const plan = planContinuationPages([source('a', words(650)), source('b', 'Seller to leave the refrigerator.')], { form, firstNumber: 7, body: lines(20), size: SIZE })
    expect(plan.starts.a).toEqual({ addendumNumber: 7, paragraph: '1' })
    const bPage = plan.pages.find((p) => p.lines.some((l) => l.startsWith('2. (From:')))
    expect(plan.starts.b.addendumNumber).toBe(bPage?.addendumNumber)
  })
})
