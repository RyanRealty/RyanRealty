import { describe, expect, it } from 'vitest'
import { cleanForOcr, isLight, isNavy, ocrWords, readingShowsCaption, readingShowsFigure, toPgm } from './ocr'

const CREAM = [250, 248, 244]
const NAVY = [16, 39, 66]
const SKY = [235, 238, 240]
const GREEN = [60, 140, 60]

/** A w x h crop from a per-pixel colour function. */
function crop(w: number, h: number, at: (x: number, y: number) => number[]): Uint8Array {
  const out = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(at(x, y), (y * w + x) * 3)
  return out
}

describe('pixel classes', () => {
  it('reads cream as light, navy as navy, and saturated colour as neither', () => {
    expect(isLight(CREAM[0], CREAM[1], CREAM[2])).toBe(true)
    expect(isLight(GREEN[0], GREEN[1], GREEN[2])).toBe(false)
    expect(isLight(170, 172, 175, 140)).toBe(true)
    expect(isNavy(NAVY[0], NAVY[1], NAVY[2])).toBe(true)
    expect(isNavy(CREAM[0], CREAM[1], CREAM[2])).toBe(false)
  })
})

describe('cleanForOcr', () => {
  it('card: cream type on the navy panel becomes black on white', () => {
    const c = cleanForOcr(crop(4, 1, (x) => (x < 2 ? CREAM : NAVY)), 4, 1, 'card')
    expect([...c]).toEqual([0, 0, 255, 255])
  })

  it('card on cream paper: the navy type is the ink', () => {
    const c = cleanForOcr(crop(4, 1, (x) => (x === 0 ? NAVY : CREAM)), 4, 1, 'card')
    expect([...c]).toEqual([0, 255, 255, 255])
  })

  it('caption: keeps light pixels near the navy outline and drops bright sky far from it', () => {
    const c = cleanForOcr(crop(40, 1, (x) => (x === 1 ? NAVY : x === 2 ? CREAM : SKY)), 40, 1, 'caption', 5)
    expect(c[2]).toBe(0)
    expect(c[39]).toBe(255)
  })

  it('writes a binary PGM tesseract can read', () => {
    const pgm = toPgm(new Uint8Array([0, 255]), 2, 1)
    expect(pgm.subarray(0, 11).toString('ascii')).toBe('P5\n2 1\n255\n')
    expect([...pgm.subarray(11)]).toEqual([0, 255])
  })
})

describe('reading back', () => {
  it('compares figures on their digits, so a dropped point still counts and another number never does', () => {
    expect(readingShowsFigure('has 35 months', '3.5')).toBe(true)
    expect(readingShowsFigure('has 3.9 months', '3.5')).toBe(false)
    expect(readingShowsFigure('4mo', '4 mo')).toBe(true)
  })

  it('needs half the longer words of a caption, and all its figures', () => {
    expect(readingShowsCaption('OF HOMES FOR SALE', 'of homes for sale').ok).toBe(true)
    expect(readingShowsCaption('HOMES', 'of homes for sale').ok).toBe(false)
    expect(readingShowsCaption('UNDER MONTHS', 'Under 4 months,').ok).toBe(false)
    expect(readingShowsCaption('UNDER 4 MONTHS', 'Under 4 months,').ok).toBe(true)
  })

  it('splits OCR text into words', () => {
    expect(ocrWords("You’re house-hunting, 3.5!")).toEqual(["you're", 'house', 'hunting', '3.5'])
  })
})
