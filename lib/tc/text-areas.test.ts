import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { areaSpace, findTextAreas, fitTextToBox, helveticaWidth, layoutAreaText, pdfSafeText, textSizeForBox, type AreaCandidate } from './text-areas'

const line = (y: number, x: number, w: number, label: string | null = null, h = 0.015, page = 1): AreaCandidate => ({ page, x, y, w, h, type: 'text', label })

// OREF 002 Addendum to Sale Agreement (live field map): the header name lines,
// then twenty body lines Text7.0 ... Text7.18.1 at a 0.0152 pitch.
const OREF_002: AreaCandidate[] = [
  line(0.141, 0.143, 0.799, 'Text3'),
  line(0.156, 0.143, 0.799, 'Text4'),
  line(0.171, 0.259, 0.681, 'Text5'),
  line(0.186, 0.089, 0.376, 'Text6'),
  line(0.186, 0.47, 0.376, 'Text34'),
  ...Array.from({ length: 20 }, (_, i) => line(0.229 + i * 0.0152, 0.095, 0.84, `Text7.${i}`)),
]

// OR 2.2 General Addendum: buyer / seller name columns, then the indented
// first body line after "The Parties agree as follows", then 25 full lines.
const OR_22: AreaCandidate[] = [
  ...[0, 1, 2, 3].flatMap((i) => [line(0.148 + i * 0.0167, 0.099, 0.401, i ? `Buyer_${i + 1}` : 'Buyer', 0.016), line(0.148 + i * 0.0167, 0.542, 0.385, i ? `Seller_${i + 1}` : 'Seller', 0.016)]),
  line(0.335, 0.256, 0.685, '13 The Parties agree as follows', 0.016),
  ...Array.from({ length: 25 }, (_, i) => line(0.351 + i * 0.0167, 0.059, 0.883, `Text${i + 6}`, 0.016)),
]

// OREF 001 page 9, Additional Provisions: two full lines and a short last one
// beside the small "For additional provisions see Addendum" blank.
const OREF_001_P9: AreaCandidate[] = [
  line(0.47, 0.094, 0.85, '28 ADDITIONAL PROVISIONS describe', 0.015, 9),
  line(0.485, 0.094, 0.85, '311', 0.015, 9),
  line(0.5, 0.094, 0.553, '312', 0.015, 9),
  line(0.5, 0.857, 0.08, 'For additional provisions see Addendum', 0.015, 9),
]

describe('finding a lined section', () => {
  it('reads the twenty body lines of OREF 002 as one text box, apart from the header lines', () => {
    const areas = findTextAreas(OREF_002)
    const body = areas.find((a) => a.lines.length === 20)
    expect(body?.lines.map((l) => l.label)).toEqual(Array.from({ length: 20 }, (_, i) => `Text7.${i}`))
    expect(areas.every((a) => !a.lines.some((l) => l.label === 'Text6' || l.label === 'Text34'))).toBe(true)
  })

  it('takes the indented first line of the 2.2 General Addendum into its body, and never the buyer and seller name lines', () => {
    const areas = findTextAreas(OR_22)
    expect(areas).toHaveLength(1)
    expect(areas[0].lines).toHaveLength(26)
    expect(areas[0].lines[0].label).toBe('13 The Parties agree as follows')
  })

  it('reads OREF 001 Additional Provisions as one box, with its short last line, and leaves the addendum-number blank out', () => {
    const areas = findTextAreas(OREF_001_P9)
    expect(areas).toEqual([{ key: 'p9:0.470', page: 9, lines: OREF_001_P9.slice(0, 3) }])
  })

  it('never reads a signature block as a section: its signature and print rows alternate in height (OREF 001 page 15)', () => {
    const block = [0, 1, 2, 3].flatMap((i) => [line(0.309 + i * 0.0385, 0.126, 0.509, `Text${77 + 2 * i}`, 0.0218, 15), line(0.3308 + i * 0.0385, 0.126, 0.509, `Text${78 + 2 * i}`, 0.0164, 15)])
    expect(findTextAreas(block)).toEqual([])
  })

  it('knows a numbered name field for what it is ("Buyer_4", "Print_5", "Dated_3")', () => {
    const rows = ['Buyer_4', 'Print_5', 'Dated_3'].map((l, i) => line(0.3 + i * 0.016, 0.126, 0.6, l))
    expect(findTextAreas(rows)).toEqual([])
    // A section heading that merely mentions a party is still a section.
    expect(findTextAreas([line(0.3, 0.1, 0.8, '8 SELLER CONTRIBUTIONS other describe'), line(0.316, 0.1, 0.8)])).toHaveLength(1)
  })

  it('ends a section where the next line has a printed label of its own (OREF 001 buyer and seller names, lines 45-48)', () => {
    const names = [line(0.223, 0.52, 0.42), line(0.238, 0.088, 0.85), line(0.254, 0.35, 0.59), line(0.269, 0.088, 0.85)]
    // Without the page text, the indented "offers to purchase from Seller" line already starts a new field.
    expect(findTextAreas(names).map((a) => a.lines.length)).toEqual([2, 2])
    // With it, a line behind its own words starts a new field even when it is not indented.
    const flush = [line(0.3, 0.1, 0.8), line(0.316, 0.1, 0.8), line(0.332, 0.1, 0.8)]
    expect(findTextAreas(flush, (l) => l.y === 0.316).map((a) => a.lines.length)).toEqual([2])
    expect(findTextAreas(flush, (l) => l.y === 0.316)[0].lines[0].y).toBe(0.316)
  })

  it('ignores a line a signer fills in, and a single line on its own', () => {
    expect(findTextAreas([{ ...line(0.2, 0.1, 0.8), recipientId: 'r1' }, line(0.215, 0.1, 0.8)])).toEqual([])
    expect(findTextAreas([line(0.2, 0.1, 0.8)])).toEqual([])
  })
})

describe('laying text onto the lines', () => {
  const space = (n: number, widthPts = 514) => Array.from({ length: n }, () => ({ widthPts }))

  it('measures exactly as pdf-lib does, so the preview and the signed PDF break the same way', async () => {
    const doc = await PDFDocument.create()
    const f = await doc.embedFont(StandardFonts.Helvetica)
    for (const s of ['Buyer to pay all HOA transfer fees.', 'AVAWAY Tyler "T.J." Nicoll', 'Wo, Ta, Te']) {
      expect(helveticaWidth(s, 9)).toBeCloseTo(f.widthOfTextAtSize(s, 9), 6)
    }
  })

  it('fills the lines in order and reports nothing left over when it fits', () => {
    const text = 'Seller to repair the leaking kitchen faucet before closing. Buyer to receive a credit of $1,500 at closing for the roof.'
    const r = layoutAreaText(text, space(3), 9)
    expect(r.overflow).toBe('')
    expect(r.lines.filter(Boolean).join(' ')).toBe(text)
    for (const l of r.lines) expect(helveticaWidth(l, 9)).toBeLessThanOrEqual(510)
  })

  it('carries what does not fit, word for word, to the overflow', () => {
    const words = Array.from({ length: 200 }, (_, i) => `term${i}`)
    const r = layoutAreaText(words.join(' '), space(3), 9)
    const placed = r.lines.join(' ').split(' ')
    expect([...placed, ...r.overflow.split(' ')]).toEqual(words)
    expect(r.overflow.length).toBeGreaterThan(0)
  })

  it('starts each paragraph on a new line and keeps a blank line between paragraphs', () => {
    const r = layoutAreaText('1. Inspection extended to 10/3.\n\n2. Closing moves to 10/31.', space(5), 9)
    expect(r.lines).toEqual(['1. Inspection extended to 10/3.', '', '2. Closing moves to 10/31.', '', ''])
  })

  it('carries whole paragraphs that did not start, keeping their breaks', () => {
    const r = layoutAreaText('First.\nSecond.\nThird.', space(1), 9)
    expect(r.lines).toEqual(['First.'])
    expect(r.overflow).toBe('Second.\nThird.')
  })

  it('splits a word longer than a line', () => {
    const r = layoutAreaText('x'.repeat(200), space(3, 120), 9)
    expect(r.lines.every((l) => l.length > 0)).toBe(true)
    expect(r.lines.join('') + r.overflow).toBe('x'.repeat(200))
  })

  it('uses the smallest line box for the whole section and the sealer width rule', () => {
    const { space: sp, size } = areaSpace([line(0.2, 0.1, 0.8, null, 0.015), line(0.215, 0.1, 0.8, null, 0.02)], 612, 792)
    expect(size).toBeCloseTo(textSizeForBox(0.015 * 792), 6)
    expect(sp[0].widthPts).toBeCloseTo(0.8 * 612, 6)
  })

  it('never hands the sealer a character its font cannot draw', () => {
    expect(pdfSafeText('Café “quoted” — ✓ 家')).toBe('Café “quoted” — ? ?')
  })
})

describe('fitTextToBox', () => {
  const box = { w: 0.2 * 612, h: 0.035 * 792 } // the composer's default text box
  it('keeps the box size for a short value', () => {
    const r = fitTextToBox('Stays', box.w, box.h)
    expect(r).toMatchObject({ fits: true, lines: ['Stays'] })
    expect(r.size).toBeCloseTo(textSizeForBox(box.h), 6)
  })
  it('shrinks a longer value until every line fits the height', () => {
    const r = fitTextToBox('Refrigerator and chest freezer stay with the home', box.w, box.h)
    expect(r.fits).toBe(true)
    expect(r.size).toBeLessThan(textSizeForBox(box.h))
    expect(r.lines.join(' ')).toBe('Refrigerator and chest freezer stay with the home')
    expect(r.lines.length * (r.size + 1.2)).toBeLessThanOrEqual(box.h - 1 + 1e-6)
  })
  it('says when even 6 pt cannot hold it, and still returns every word', () => {
    const long = 'word '.repeat(200).trim()
    const r = fitTextToBox(long, box.w, box.h)
    expect(r.fits).toBe(false)
    expect(r.size).toBe(6)
    expect(r.lines.join(' ').split(' ')).toHaveLength(200)
  })
})
