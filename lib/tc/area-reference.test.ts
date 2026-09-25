import { describe, expect, it } from 'vitest'
import { areaReference, lineHasLabel, pageMarks, referenceLabel, type PageMarks, type TextRun } from './area-reference'

const run = (str: string, x: number, y: number, w: number): TextRun => ({ str, x, y, w })
/** A margin line number as pdfjs gives it on a letter page at 8 pt. */
const num = (n: number, y: number, x = 0.037): TextRun => run(String(n), x, y, (String(n).length * 4.45) / 612)
const blank = (y: number, x = 0.088) => run('_'.repeat(70), x, y, 0.85)

// OREF 001 (01/2026) page 9, lines 347-352, as pdfjs reads the live blank.
const OREF_001_P9: TextRun[] = [
  run('If Yes, identify plan and cost: ____________', 0.088, 0.4313, 0.8),
  num(347, 0.4313),
  run('The warranty will be ordered and paid for by (', 0.088, 0.4464, 0.26),
  run('select one', 0.351, 0.4464, 0.055),
  num(348, 0.4464),
  run('29. ADDITIONAL PROVISIONS:', 0.088, 0.4692, 0.19),
  run('(', 0.283, 0.4692, 0.004),
  run('describe', 0.288, 0.4692, 0.047),
  run(') ______________________________', 0.337, 0.4692, 0.6),
  num(349, 0.4692),
  blank(0.4843),
  num(350, 0.4843),
  blank(0.4995),
  num(351, 0.4995),
  run('____________________', 0.088, 0.5146, 0.55),
  run('. For more provisions, see Addendum ___________.', 0.64, 0.5146, 0.3),
  num(352, 0.5146),
]
// Its four boxes, from the live field map.
const P9_AREA = { page: 9, lines: [0.455, 0.4701, 0.4852, 0.5003].map((y, i) => ({ x: i ? 0.088 : 0.345, y, w: i === 3 ? 0.553 : 0.85, h: 0.0164 })) }

describe('reading the printed page', () => {
  it('finds the margin line numbers and the numbered heading on an OREF page', () => {
    const m = pageMarks(OREF_001_P9)
    expect(m.lineNumbers.map((l) => l.n)).toEqual([347, 348, 349, 350, 351, 352])
    expect(m.headings).toEqual([{ number: '29', title: 'Additional Provisions', y: 0.4692 }])
  })

  it('pieces an OR heading back together from its split runs (OR 5.6, line 24)', () => {
    const m = pageMarks([
      run('24', 0.03, 0.5584, 0.0163),
      run('6', 0.059, 0.5584, 0.0091),
      run('.', 0.067, 0.5584, 0.0045),
      run('Seller’s', 0.078, 0.5584, 0.05),
      run('Instructions to Escrow', 0.133, 0.5584, 0.15),
      run('/Trust Account Holder', 0.288, 0.5584, 0.155),
      run('.', 0.444, 0.5584, 0.0045),
      run('Seller', 0.455, 0.5584, 0.04),
      run('instructs Escrow', 0.498, 0.5584, 0.1),
    ])
    expect(m.lineNumbers).toEqual([{ n: 24, y: 0.5584 }])
    expect(m.headings).toEqual([{ number: '6', title: 'Seller’s Instructions to Escrow/Trust Account Holder', y: 0.5584 }])
  })

  it('keeps a heading number that is not a margin line number, and never takes a sentence for a heading', () => {
    // No line-number column: "6" sits right against its title.
    expect(pageMarks([run('6', 0.059, 0.3, 0.0091), run('. Seller’s Instructions. Seller instructs', 0.067, 0.3, 0.3)]).headings[0]?.number).toBe('6')
    expect(pageMarks([run('1. Buyer will pay the costs. Seller will not.', 0.088, 0.3, 0.5)]).headings).toEqual([])
    expect(pageMarks([run('2.2. Personal Property.', 0.104, 0.1358, 0.14), run('Personal property refers to objects', 0.25, 0.1358, 0.4)]).headings[0]).toMatchObject({ number: '2.2', title: 'Personal Property' })
  })
})

describe('where a section sits', () => {
  it('cites Section 29 Additional Provisions, lines 349-352 for OREF 001 page 9', () => {
    const marks: Array<PageMarks | null> = Array.from({ length: 9 }, () => null)
    marks[8] = pageMarks(OREF_001_P9)
    const ref = areaReference(marks, P9_AREA)
    expect(ref).toEqual({ number: '29', heading: 'Additional Provisions', lines: '349-352' })
    expect(referenceLabel(ref)).toBe('Section 29 Additional Provisions, lines 349-352')
  })

  it('finds the heading on the page before when the section runs onto the next page (OREF 001 section 12.2(b), page 7)', () => {
    const p6 = pageMarks([run('12.2. Inspections or Waiver of Inspections.', 0.104, 0.6, 0.3), num(227, 0.6), run('12.1. SUITABILITY CONTINGENCY:', 0.104, 0.5, 0.2)])
    const p7 = pageMarks([num(252, 0.2658), num(253, 0.281), blank(0.2658, 0.128), blank(0.281, 0.128)])
    const ref = areaReference([null, null, null, null, null, p6, p7], { page: 7, lines: [{ y: 0.2505, h: 0.0164 }, { y: 0.2657, h: 0.0164 }] })
    expect(ref).toEqual({ number: '12.2', heading: 'Inspections or Waiver of Inspections', lines: '252-253' })
  })

  it('never takes a heading printed below the section', () => {
    const p = pageMarks([num(6, 0.2432, 0.052), num(7, 0.2583, 0.052), run('5. SIGNATURES:', 0.088, 0.9, 0.2)])
    expect(areaReference([p], { page: 1, lines: [{ y: 0.229, h: 0.0152 }, { y: 0.2442, h: 0.0152 }] })).toEqual({ number: null, heading: null, lines: '6-7' })
  })

  it('names a section by the form field when the page prints no heading, and cites one line as a line', () => {
    expect(referenceLabel({ number: null, heading: null, lines: '6-25' }, null)).toBe('lines 6-25')
    expect(referenceLabel({ number: null, heading: null, lines: '54' }, 'Other Notice')).toBe('Other Notice, line 54')
    expect(referenceLabel({ number: null, heading: null, lines: null }, null)).toBeNull()
  })
})

describe('a line with a label of its own', () => {
  // OREF 002 lines 1-2: "Buyer(s) ____" and "Seller(s) ____", each box after its label.
  const header = pageMarks([run('Buyer(s) _______________', 0.088, 0.1554, 0.85), num(1, 0.1554, 0.052), run('Seller(s) ______________', 0.088, 0.1706, 0.85), num(2, 0.1706, 0.052)])

  it('is its own field: "Seller(s)" does not continue "Buyer(s)"', () => {
    expect(lineHasLabel(header, { x: 0.143, y: 0.156, h: 0.0152 })).toBe(true)
  })

  it('is never a bare line number, even one set in from the margin', () => {
    const inset = pageMarks([run('14', 0.083, 0.3, 0.012)])
    expect(inset.lineNumbers).toEqual([])
    expect(lineHasLabel(inset, { x: 0.095, y: 0.29, h: 0.0152 })).toBe(false)
  })

  it('is not a ruled blank or the margin number (OREF 001 line 350)', () => {
    expect(lineHasLabel(pageMarks(OREF_001_P9), P9_AREA.lines[1])).toBe(false)
    expect(lineHasLabel(null, P9_AREA.lines[1])).toBe(false)
  })
})
