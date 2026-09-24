import { describe, it, expect } from 'vitest'
import { fieldRectToPdf, sha256Hex } from './seal-pdf'

// H4: the field-rect conversion (the top-left fraction -> pdf-lib bottom-left
// point box) is what places every signature/date/checkbox on the EXECUTED legal
// PDF. A regression in the y-flip silently lands a signature in the wrong spot on
// a signed document. US-Letter portrait is 612 x 792 pt.
const LETTER_W = 612
const LETTER_H = 792

describe('fieldRectToPdf', () => {
  it('scales the fractional width/height into page points', () => {
    const r = fieldRectToPdf({ x: 0.5, y: 0.25, w: 0.2, h: 0.05 }, LETTER_W, LETTER_H)
    expect(r.x).toBeCloseTo(306, 5) // 0.5 * 612
    expect(r.w).toBeCloseTo(122.4, 5) // 0.2 * 612
    expect(r.h).toBeCloseTo(39.6, 5) // 0.05 * 792
  })

  it('applies the y-flip: y = pageHeight - fieldTopFraction*pageHeight - boxHeight', () => {
    const r = fieldRectToPdf({ x: 0.5, y: 0.25, w: 0.2, h: 0.05 }, LETTER_W, LETTER_H)
    // 792 - 0.25*792 - 39.6 = 792 - 198 - 39.6 = 554.4
    expect(r.y).toBeCloseTo(554.4, 5)
  })

  it('a full-page field maps to the whole page (origin 0,0)', () => {
    const r = fieldRectToPdf({ x: 0, y: 0, w: 1, h: 1 }, LETTER_W, LETTER_H)
    expect(r).toMatchObject({ x: 0, w: LETTER_W, h: LETTER_H })
    expect(r.y).toBeCloseTo(0, 5) // bottom-left origin
  })

  it('a field at the TOP of the page lands HIGH in pdf-lib bottom-left space', () => {
    // small top-fraction y → high pdf y (near the top); the box top edge sits at
    // pageHeight*(1 - fieldTopFraction).
    const top = fieldRectToPdf({ x: 0.1, y: 0.02, w: 0.2, h: 0.04 }, LETTER_W, LETTER_H)
    const bottom = fieldRectToPdf({ x: 0.1, y: 0.92, w: 0.2, h: 0.04 }, LETTER_W, LETTER_H)
    expect(top.y).toBeGreaterThan(bottom.y) // top of page is higher in pdf coords
    // box top edge (y + h) === pageHeight * (1 - fieldTopFraction)
    expect(top.y + top.h).toBeCloseTo(LETTER_H * (1 - 0.02), 5)
    expect(bottom.y + bottom.h).toBeCloseTo(LETTER_H * (1 - 0.92), 5)
  })

  it('monotonic: increasing the top-fraction y moves the box DOWN the page (lower pdf y)', () => {
    const ys = [0.1, 0.3, 0.5, 0.7, 0.9].map(
      (fy) => fieldRectToPdf({ x: 0, y: fy, w: 0.1, h: 0.05 }, LETTER_W, LETTER_H).y,
    )
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeLessThan(ys[i - 1]!)
  })

  it('works on a non-Letter page size (geometry is page-relative)', () => {
    const r = fieldRectToPdf({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 1000, 2000)
    expect(r).toMatchObject({ x: 500, w: 500, h: 1000 })
    expect(r.y).toBeCloseTo(2000 - 0.5 * 2000 - 1000, 5) // = 0
  })
})

describe('sha256Hex', () => {
  it('hashes deterministically (the executed-doc integrity hash)', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const a = sha256Hex(bytes)
    const b = sha256Hex(new Uint8Array([1, 2, 3, 4]))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(new Uint8Array([1, 2, 3, 5]))).not.toBe(a)
  })
})

describe('sealEnvelope text (lined sections)', () => {
  it('draws a laid-out line as is and never fails on a character the font cannot encode', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const { sealEnvelope } = await import('./seal-pdf')
    const src = await PDFDocument.create()
    src.addPage([612, 792])
    const bytes = await src.save()
    const field = (id: string, value: { kind: 'text'; text: string; size?: number } | { kind: 'date_signed'; text: string }) => ({
      id, documentId: 'd', recipientId: null, type: 'text' as const, page: 1, x: 0.095, y: 0.229, w: 0.84, h: 0.015, required: false, value, signedAt: null,
    })
    const res = await sealEnvelope({
      envelopeId: 'e',
      envelopeName: 'Test',
      sealedAtIso: '2026-09-24T19:00:00Z',
      recipients: [],
      documents: [{ bytes, name: 'Addendum.pdf', fields: [field('a', { kind: 'text', text: 'Seller to repair the roof ✓ before closing.', size: 8.5 }), field('b', { kind: 'text', text: 'Café 家' }), field('c', { kind: 'date_signed', text: '09/24/2026 ✓' })] }],
    })
    expect(res.pageCount).toBe(2) // the page and the certificate
  })
})
