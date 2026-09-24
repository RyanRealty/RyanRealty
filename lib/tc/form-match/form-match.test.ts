import { describe, expect, it } from 'vitest'
import { addedInk, align, consensus, descriptor, descriptorGap, dilate, inkPoints, isFilled, packMask, shifted, unpackMask, type Mask } from './raster'
import { footerOf, layoutOf, linesOf, partyOfLabel, textUsable, type TextItem } from './layout'
import { checkInstance, describeCheck, instancesOf, loadPage, matchPage, resolveTies, type FormCheck, type PageMatch, type TemplateInfo } from './check'
import { learnPage } from './learn'

function blank(w = 120, h = 80): Mask {
  return { w, h, bits: new Uint8Array(w * h) }
}
function rect(m: Mask, x0: number, y0: number, x1: number, y1: number): Mask {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.bits[y * m.w + x] = 1
  return m
}
/** A fake printed form: a frame, three rules and a heading block. */
function form(): Mask {
  const m = blank()
  rect(m, 5, 5, 115, 7)
  rect(m, 5, 73, 115, 75)
  rect(m, 10, 20, 60, 21)
  rect(m, 10, 40, 100, 41)
  rect(m, 10, 60, 100, 61)
  rect(m, 30, 10, 90, 14)
  // Small marks in distinct places (line numbers, a checkbox): real forms are never symmetric.
  rect(m, 3, 22, 6, 26)
  rect(m, 104, 44, 108, 48)
  rect(m, 70, 64, 73, 70)
  rect(m, 15, 50, 18, 52)
  return m
}
function copyOf(base: Mask, dx = 0, dy = 0): Mask {
  return shifted(base, -dx, -dy)
}

describe('raster', () => {
  it('lines a shifted copy up with its template', () => {
    const t = form()
    const c = copyOf(t, 3, -2)
    const a = align(inkPoints(t, 1), t.w, dilate(c, 1), 6, 1)
    expect(a.coverage).toBeGreaterThan(0.99)
    expect([a.dx, a.dy]).toEqual([3, -2])
  })

  it('a different form covers far less of the template', () => {
    const t = form()
    const other = rect(rect(blank(), 50, 0, 52, 80), 0, 30, 120, 32)
    expect(align(inkPoints(t, 1), t.w, dilate(other, 1), 6, 1).coverage).toBeLessThan(0.5)
  })

  it('reads a signature as ink the template does not print, and ignores the printed rule', () => {
    const t = form()
    const signed = copyOf(t)
    rect(signed, 20, 34, 50, 39) // a scrawl above the rule at y=40
    const box = { x0: 10, y0: 30, x1: 100, y1: 42 }
    expect(isFilled(addedInk(t, dilate(t, 1), signed, box, { dx: 0, dy: 0 }))).toBe(true)
    expect(isFilled(addedInk(t, dilate(t, 1), copyOf(t), box, { dx: 0, dy: 0 }))).toBe(false)
  })

  it('packs and unpacks a mask', () => {
    const t = form()
    expect(unpackMask(packMask(t), t.w, t.h).bits).toEqual(t.bits)
  })

  it('keeps only the ink every copy shares', () => {
    const t = form()
    const a = rect(copyOf(t), 20, 34, 40, 39)
    const b = rect(copyOf(t), 60, 54, 90, 59)
    expect(consensus([a, b], 1).bits).toEqual(t.bits)
  })

  it('ranks the template nearest a filled copy first', () => {
    const t = form()
    const filled = rect(copyOf(t), 20, 34, 40, 39)
    const other = rect(blank(), 0, 30, 120, 50)
    expect(descriptorGap(descriptor(t), descriptor(filled))).toBeLessThan(descriptorGap(descriptor(other), descriptor(filled)))
  })
})

const item = (str: string, x: number, y: number, w: number, font = 'f1'): TextItem => ({ str, x, y, w, h: 9, font })

describe('layout', () => {
  const orefPage: TextItem[] = [
    item('51. SELLER’S RESPONSE: (select one)', 54, 420, 300),
    item('593', 23, 600, 13),
    item('Seller ________________________________________ Date/Time ____________________', 54, 600, 508),
    item('', 565, 601, 11, 'sym'),
    item('Print ______________________________', 58, 612, 330),
    item('Seller Initials ________ / ________ Buyer Initials ________ / ________', 28, 723, 420),
    item('LINES WITH THIS SYMBOL', 27, 744, 103),
    item('', 132, 744, 9, 'sym'),
    item('REQUIRE A SIGNATURE AND DATE', 143, 744, 135),
    item('OREF 001 | Released 01/2026 | Page 15 of 15', 407, 744, 168),
  ]

  it('reads the OREF footer: form, release, page of', () => {
    expect(footerOf(linesOf(orefPage))).toMatchObject({ family: 'OREF', number: '001', release: '01/2026', page: 15, of: 15 })
  })

  it('finds the seller line, its date and print boxes, its section, and the ← marker', () => {
    const lay = layoutOf(orefPage, { width: 612, height: 792 })
    expect(lay.signatures).toHaveLength(1)
    const s = lay.signatures[0]
    expect(s).toMatchObject({ party: 'seller', label: 'Seller', required: true })
    expect(s.section).toMatch(/SELLER.S RESPONSE/)
    expect(s.date).not.toBeNull()
    expect(s.print).not.toBeNull()
    expect(s.sig.x1).toBeLessThan(s.date!.x0)
  })

  it('a line without the ← is not required when the form has the legend', () => {
    const page = orefPage.filter((i) => !(i.font === 'sym' && i.y === 601))
    expect(layoutOf(page, { width: 612, height: 792 }).signatures[0].required).toBe(false)
  })

  it('reads the initials boxes per party', () => {
    const lay = layoutOf(orefPage, { width: 612, height: 792 })
    expect(lay.initials.map((i) => [i.party, i.rects.length])).toEqual([
      ['seller', 2],
      ['buyer', 2],
    ])
  })

  it('a names field ("Buyer(s) ____") is not a signature line', () => {
    const lay = layoutOf([item('Buyer(s) ______________________________', 60, 160, 400)], { width: 612, height: 792 })
    expect(lay.signatures).toHaveLength(0)
  })

  it('reads the Oregon REALTORS® style: label under a drawn rule', () => {
    const lay = layoutOf(
      [
        item('7. Signatures. By mutually accepting the above terms', 36, 573, 400),
        item('37', 19, 600, 10),
        item('Buyer’s Signature', 36, 600, 71),
        item('Date', 363, 600, 19),
        item('& Time', 384, 600, 29),
        item('Form 2.1 · Counteroffer · Version 2026-2 Page 1 of 1', 159, 732, 420),
        item('Copyright © 2023 Oregon REALTORS®.', 156, 744, 250),
      ],
      { width: 612, height: 792 },
    )
    expect(lay.footer).toMatchObject({ family: 'OR', number: '2.1', release: '2026-2' })
    expect(lay.signatures).toHaveLength(1)
    expect(lay.signatures[0]).toMatchObject({ party: 'buyer', required: null })
    expect(lay.signatures[0].sig.y1).toBeLessThan(600)
  })

  it('names parties from printed labels', () => {
    expect(partyOfLabel('Seller’s Agent')).toBe('seller_agent')
    expect(partyOfLabel('211 Seller')).toBe('seller')
    expect(partyOfLabel('Buyer')).toBe('buyer')
    expect(partyOfLabel('Buyer(s)')).toBe('buyer')
    expect(partyOfLabel('Phone Number')).toBeNull()
  })

  it('tells a real text layer from a flattened print', () => {
    expect(textUsable('SELLER’S COUNTEROFFER NO. 1 This is a counteroffer to the Sale Agreement or Buyer’s Counteroffer. Property Address')).toBe(true)
    expect(textUsable(`!" # $ $ % !&' ( &' ) *+! ,, - . & /*+!/' 0 1 , + ++! + 23 45 !" # $$ % &' ()`)).toBe(false)
  })
})

function tpl(pages: number[]): TemplateInfo {
  return {
    id: 't1',
    family: 'OREF',
    formNumber: '003',
    release: '01/2025',
    edition: 'a',
    title: 'OREF 003',
    pageCount: pages.length,
    source: 'learned',
    pages: pages.map((p) => ({
      page: p,
      w: 120,
      h: 80,
      footer: null,
      descriptor: new Uint8Array(320),
      signatures: [{ party: 'seller', label: 'Seller', section: '1. AGREEMENT', required: true, sig: { x0: 10, y0: 30, x1: 100, y1: 42 }, date: null, print: null }],
      initials: [],
    })),
  }
}
const pm = (page: number, templatePage: number | null, templateId: string | null = 't1'): PageMatch => ({ page, templateId, templatePage, coverage: 1, dx: 0, dy: 0, nearest: null })

describe('check', () => {
  it('matches a page to its template and reports the nearest when none matches', () => {
    const t = tpl([1])
    const lp = loadPage(t, t.pages[0], form())
    const c = copyOf(form())
    expect(matchPage(c, dilate(c, 1), [lp], 1)).toMatchObject({ templateId: 't1', templatePage: 1 })
    const other = rect(blank(), 0, 0, 120, 3)
    expect(matchPage(other, dilate(other, 1), [lp], 2).templateId).toBeNull()
  })

  it('splits two copies of one form in a PDF into two instances', () => {
    const inst = instancesOf([pm(1, 1), pm(2, 2), pm(3, 1), pm(4, 2), pm(5, null, null)])
    expect(inst.map((i) => i.pages.map((p) => p.page))).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('finds a missing page and an unsigned seller', () => {
    const t = tpl([1, 2])
    const masks = new Map([[1, copyOf(form())]])
    const lp = loadPage(t, t.pages[0], form())
    const check = checkInstance(t, [pm(1, 1)], (n) => (n === 1 ? lp : null), (d) => masks.get(d)!)
    expect(check.missingPages).toEqual([2])
    expect(check.lines[0].signed).toBe(false)
    expect(describeCheck(check).issues).toEqual(['missing page 2 of 2', 'seller has not signed'])
  })

  it('counts signers against the parties named', () => {
    const c: FormCheck = {
      templateId: 't1', family: 'OREF', formNumber: '003', release: null, title: '', source: 'library', pageCount: 1,
      pages: [{ templatePage: 1, docPage: 1, coverage: 1 }], missingPages: [],
      lines: [
        { page: 1, party: 'seller', label: 'Seller', section: 'S', required: true, signed: true, dated: true, printed: true, ink: 90 },
        { page: 1, party: 'seller', label: 'Seller', section: 'S', required: true, signed: false, dated: false, printed: false, ink: 0 },
      ],
      initials: [],
    }
    expect(describeCheck(c, { seller: 1 }).complete).toBe(true)
    expect(describeCheck(c, { seller: 2 }).issues).toEqual(['2 sellers named, 1 signed'])
  })
})

describe('releases', () => {
  it('a page printed the same in two releases goes to the release the rest of the copy matches', () => {
    const shared: PageMatch = {
      ...pm(2, 2, 'r2026'),
      alternatives: [{ templateId: 'r2025', templatePage: 2, coverage: 1, dx: 0, dy: 0 }],
    }
    const out = resolveTies([pm(1, 1, 'r2025'), shared, pm(3, 3, 'r2025')])
    expect(out.map((m) => m.templateId)).toEqual(['r2025', 'r2025', 'r2025'])
    expect(instancesOf(out)).toHaveLength(1)
  })

  it('an empty date box is a note, not a missing signature', () => {
    const c: FormCheck = {
      templateId: 't1', family: 'OREF', formNumber: '057', release: '01/2026', title: '', source: 'library', pageCount: 1,
      pages: [{ templatePage: 1, docPage: 1, coverage: 1 }], missingPages: [],
      lines: [{ page: 1, party: 'seller', label: 'Seller', section: 'S', required: true, signed: true, dated: false, printed: true, ink: 300 }],
      initials: [],
    }
    expect(describeCheck(c)).toEqual({ complete: true, issues: [], notes: ['1 seller signature with an empty date box'] })
  })
})

describe('learn', () => {
  it('learns the printed form from copies filled differently', () => {
    const base = form()
    const a = rect(copyOf(base), 20, 34, 40, 39)
    const b = rect(copyOf(base, 2, 1), 60, 54, 90, 59)
    const learned = learnPage([a, b])!
    expect(learned.members).toHaveLength(2)
    const cov = align(inkPoints(base, 1), base.w, dilate(learned.template, 1), 3, 1).coverage
    expect(cov).toBeGreaterThan(0.97)
    // No fill survives.
    expect(isFilled(addedInk(base, dilate(base, 1), learned.template, { x0: 10, y0: 30, x1: 100, y1: 60 }, { dx: 0, dy: 0 }))).toBe(false)
  })

  it('needs two copies', () => {
    expect(learnPage([form()])).toBeNull()
  })
})
