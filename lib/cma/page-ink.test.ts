import { describe, expect, it } from 'vitest'
import type { PdfTextRun } from '@/lib/pdf/assert-page-safety'
import { CMA_MARGIN_IN, PAPER, marginsToPt } from '@/lib/pdf/page-contract'
import { headingTailFailures, isSectionHead, nearBlankFailures, NEAR_BLANK_FILL } from '@/lib/cma/page-ink'

function run(text: string, y0: number): PdfTextRun {
  return { x0: 50, x1: 400, y0, y1: y0 + 10, text }
}

describe('heading tails', () => {
  it('reads a chapter title whether or not the letters were split', () => {
    expect(isSectionHead('WHAT PRICE AND TIME LOOK LIKE IN BEND.')).toBe(true)
    expect(isSectionHead('W H A T P R I C E A N D T I M E')).toBe(true)
    expect(isSectionHead('Listed at $499,900 since September.')).toBe(false)
  })

  it('fails a sheet whose last ink is the next chapter heading', () => {
    const y = marginsToPt(CMA_MARGIN_IN).bottom + 24
    const page: PdfTextRun[] = [
      run('Four homes are for sale within one mile and a buyer can choose them.', 480),
      run('12 PINE · WHAT PRICE AND TIME LOOK LIKE IN BEND', y + 28),
      run('WHAT PRICE AND TIME LOOK LIKE IN BEND.', y),
    ]
    const size = { w: PAPER.widthPt, h: PAPER.heightPt }
    const fails = headingTailFailures([page, page], [size, size], 'shape')
    expect(fails.some((f) => /heading tail/.test(f))).toBe(true)
    expect(fails.some((f) => /section banner tail/.test(f))).toBe(true)
  })

  it('passes when the heading keeps its first sentence', () => {
    const y = marginsToPt(CMA_MARGIN_IN).bottom + 80
    const page: PdfTextRun[] = [
      run('WHAT PRICE AND TIME LOOK LIKE IN BEND.', y + 40),
      run('Half of the homes that sold had an offer inside 26 days.', y),
    ]
    const size = { w: PAPER.widthPt, h: PAPER.heightPt }
    expect(headingTailFailures([page, page], [size, size], 'shape')).toEqual([])
  })

  it('fails a sheet whose text covers less than a fifth of the page', () => {
    expect(NEAR_BLANK_FILL).toBe(0.2)
    const margins = marginsToPt(CMA_MARGIN_IN)
    const boxH = PAPER.heightPt - margins.top - margins.bottom
    const size = { w: PAPER.widthPt, h: PAPER.heightPt }
    const thin: PdfTextRun[] = [run('Sold $/sqft', 640), run('$326', 620)]
    const full: PdfTextRun[] = [run('Four homes are for sale in this range.', 640), run('Adjusted $500,000', 640 - boxH * 0.5)]
    const cover: PdfTextRun[] = [run('short', 100)]
    const fails = nearBlankFailures([cover, thin, full], [size, size, size], 'shape')
    expect(fails.some((f) => /p2: near-blank/.test(f))).toBe(true)
    expect(fails.some((f) => /p3/.test(f))).toBe(false)
    expect(fails.some((f) => /p1/.test(f))).toBe(false)
  })
})
