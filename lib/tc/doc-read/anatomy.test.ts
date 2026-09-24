import { describe, expect, it } from 'vitest'
import { MAX_PAGES_PER_PASS, pageFacts, passesFor, pickPages, readAnatomy, type PageText } from './anatomy'

const stamp = (n: string, i: number, total: number) => `OREF ${n} | Released 01/2025 | Page ${i} of ${total}`
const body = 'x'.repeat(400)
const page = (p: number, text: string, annotations: string[] = []): PageText => ({ page: p, text: `${body} ${text}`, annotations })

describe('pageFacts', () => {
  it('reads the OREF footer stamp and the printed signature lines', () => {
    const f = pageFacts(page(14, `Buyer ______________________________ Print ______ Date ____ Seller Initials ________ / ________ ${stamp('001', 14, 15)}`))
    expect(f.oref).toEqual({ number: '001', released: '01/2025', index: 14, total: 15 })
    expect(f.signatureLabels).toEqual(['Buyer'])
  })

  it('does not take a form number mentioned in the body for a second form', () => {
    const f = pageFacts(page(15, `attached to this agreement OREF 003 – Seller's Counteroffer. ${stamp('001', 15, 15)}`))
    expect(f.oref?.number).toBe('001')
  })

  it('finds e-sign evidence in text and in link annotations', () => {
    const f = pageFacts(page(1, 'Docusign Envelope ID: F81C3FD6-ECB7-410D-926B-76D9AAE264A1', ['DigiSign Verified - 1ef1b35e-8920-4bb2-85f8-acbab6bcc87d']))
    expect(f.esign).toEqual([
      { vendor: 'docusign', envelopeId: 'F81C3FD6-ECB7-410D-926B-76D9AAE264A1' },
      { vendor: 'digisign', envelopeId: '1ef1b35e-8920-4bb2-85f8-acbab6bcc87d' },
    ])
  })
})

describe('segments', () => {
  it('splits a packet by footer stamp and by a restart of the same form', () => {
    const pages = [
      page(1, stamp('043', 1, 1)),
      page(2, stamp('021', 1, 2)),
      page(3, `Buyer ________ ${stamp('021', 2, 2)}`),
      page(4, stamp('002', 1, 1)),
      page(5, stamp('002', 1, 1)),
    ]
    const a = readAnatomy(pages)
    expect(a.segments.map((s) => [s.oref, s.pages])).toEqual([
      ['043', [1]],
      ['021', [2, 3]],
      ['002', [4]],
      ['002', [5]],
    ])
  })

  it('pages past a stamped form\'s own length start a new segment', () => {
    const a = readAnatomy([page(1, stamp('021', 1, 2)), page(2, stamp('021', 2, 2)), page(3, 'Certificate'), page(4, 'Signature ________')])
    expect(a.segments.map((s) => s.pages)).toEqual([[1, 2], [3, 4]])
  })

  it('marks a PDF with no text layer as a scan', () => {
    expect(readAnatomy([{ page: 1, text: '' }, { page: 2, text: '  ' }]).scanned).toBe(true)
  })
})

describe('pickPages', () => {
  it('reads an OREF 001 from its first page and its signature pages, not the terms', () => {
    const pages = Array.from({ length: 15 }, (_, i) =>
      page(i + 1, `${i === 13 ? 'Buyer ______________ Print' : ''}${i === 14 ? 'Seller ______________ Print' : ''} ${stamp('001', i + 1, 15)}`),
    )
    expect(pickPages(readAnatomy(pages)).map((p) => [p.page, p.why])).toEqual([
      [1, 'first'],
      [14, 'signature'],
      [15, 'signature'],
    ])
  })

  it('falls back to the last page when no signature line is in the text', () => {
    const picks = pickPages(readAnatomy([page(1, stamp('020', 1, 3)), page(2, stamp('020', 2, 3)), page(3, stamp('020', 3, 3))]))
    expect(picks.map((p) => p.page)).toEqual([1, 3])
  })

  it('splits long packets into passes without splitting a form', () => {
    const picks = Array.from({ length: 11 }, (_, i) => ({ page: i + 1, segment: Math.floor(i / 3) + 1, why: 'first' as const }))
    const passes = passesFor(picks)
    expect(passes.every((p) => p.length <= MAX_PAGES_PER_PASS)).toBe(true)
    for (const pass of passes) {
      const segs = new Set(pass.map((p) => p.segment))
      for (const s of segs) expect(passes.filter((q) => q.some((p) => p.segment === s))).toHaveLength(1)
    }
  })
})
