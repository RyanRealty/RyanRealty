/**
 * WORKSTREAM B, PHONE FIRST (Matt 2026-10-07).
 *
 * The Keats report ran 23,800px at 375: three comparison chapters of full
 * cards, a status table ahead of the sales, rows of dashes, and a map whose
 * pins piled into one blob. Each test below holds one of the fixes, and each
 * one holds the rule that nothing is dropped from either document.
 */
import { describe, expect, it } from 'vitest'
import {
  CDOM_ROW_LABEL,
  STACK_OPEN_CARDS,
  renderCompMatrixHtml,
  renderMatrixHtml,
  stackFoldHtml,
} from '@/lib/cma/comp-matrix'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'
import { salesGlanceHtml, salesGlanceRows } from '@/lib/cma/sales-glance'
import {
  statusPriceBoardDisclosureHtml,
  statusPriceBoardHomes,
  statusPriceBoardHtml,
  statusPriceSummaries,
} from '@/lib/cma/status-price-summary'
import { immersiveInteractionScript } from '@/lib/cma/immersive-interactions'
import { immersiveStylesheet } from '@/lib/cma/immersive-css'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderCompPinMapHtml, layoutCompPins } from '@/lib/cma/comp-pin-map'
import { FULL_CROP, intoCrop, phoneCrop, relaxPins } from '@/lib/cma/pin-layout'
import { findSellerBannedWords } from '@/lib/cma/seller-text'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

function entry(over: Partial<MatrixEntry> & Pick<MatrixEntry, 'family' | 'key'>): MatrixEntry {
  return {
    address: over.address ?? `${over.key} Pine`,
    href: null,
    photoUrl: null,
    outcome: '',
    yearBuilt: 1999,
    remodelNote: null,
    remarksRead: false,
    sqft: 1600,
    lotAcres: 0.2,
    rooms: null,
    beds: 3,
    baths: 2,
    domDays: 20,
    priceChanges: 0,
    priceChangesExact: false,
    path: null,
    firstAsk: 600000,
    lastAsk: 580000,
    closePrice: null,
    listPrice: 580000,
    concessionsAmount: null,
    proximity: null,
    garageSpaces: null,
    cdomDays: null,
    statusDate: null,
    adjustedPrice: null,
    endLabel: 'came off',
    latitude: null,
    longitude: null,
    sort: '',
    ...over,
  }
}

const subjectEntry = entry({ key: 'subject', family: 'subject', address: '2566 Keats', garageSpaces: 2 })

function unsold(n: number, over: Partial<MatrixEntry> = {}): MatrixEntry[] {
  const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']
  return Array.from({ length: n }, (_, i) =>
    entry({ key: romans[i]!, family: 'unsold', mlsStatus: 'Expired', sqft: 1500 + i * 50, ...over }),
  )
}

/** The <th> labels of every row in the shared (non-adjustment) table. */
function rowLabels(html: string): string[] {
  const table = /<table class="kv is-wide comp-matrix is-\w+">[\s\S]*?<\/table>/.exec(html)?.[0] ?? ''
  return [...table.matchAll(/<tr[^>]*><th>([\s\S]*?)<\/th>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

describe('a row no other home fills is not printed (2d)', () => {
  it('drops the sale rows from the listings that came off, and Garage when only yours has one', () => {
    const html = renderMatrixHtml({
      id: 'did-not-sell',
      family: 'unsold',
      heading: 'The listings in this area that came off unsold',
      entries: [subjectEntry, ...unsold(3)],
    })
    const labels = rowLabels(html)
    for (const gone of ['Sold', 'Seller concessions', 'Sold after concessions', 'Sold $/sqft', 'Adjusted', 'Garage']) {
      expect(labels, gone).not.toContain(gone)
    }
    // The rows the homes DO fill stay, with your own column.
    for (const kept of ['Status', 'List price', 'Original list', 'Days on market', 'Size', 'Lot size', 'List $/sqft']) {
      expect(labels, kept).toContain(kept)
    }
    expect(html).toContain('Your home')
    // The phone card reads the same folded rows.
    expect(html).not.toMatch(/comp-stack-line[^>]*><span class="k">Sold after concessions</)
  })

  it('keeps Garage when another home has one, dash and all', () => {
    const homes = unsold(3)
    homes[1] = { ...homes[1]!, garageSpaces: 3 }
    const labels = rowLabels(
      renderMatrixHtml({
        id: 'did-not-sell',
        family: 'unsold',
        heading: 'x',
        entries: [subjectEntry, ...homes],
      }),
    )
    expect(labels).toContain('Garage')
  })
})

describe('CDOM prints only when it says something new (2d)', () => {
  it('goes when every home counts the same days in both rows', () => {
    const html = renderMatrixHtml({
      id: 'did-not-sell',
      family: 'unsold',
      heading: 'x',
      entries: [subjectEntry, ...unsold(3, { domDays: 40, cdomDays: 40 })],
    })
    expect(html).not.toContain('CDOM')
    expect(html).not.toContain(CDOM_ROW_LABEL)
    expect(rowLabels(html)).toContain('Days on market')
  })

  it('stays, in words, when any home counts differently', () => {
    const homes = unsold(3, { domDays: 40, cdomDays: 40 })
    homes[2] = { ...homes[2]!, domDays: 12, cdomDays: 190 }
    const html = renderMatrixHtml({
      id: 'did-not-sell',
      family: 'unsold',
      heading: 'x',
      entries: [subjectEntry, ...homes],
    })
    expect(html).not.toContain('CDOM')
    expect(rowLabels(html)).toContain(CDOM_ROW_LABEL)
    expect(html).toContain('190 days')
  })
})

describe('the phone card list folds after the first homes (2c)', () => {
  it('opens on the first homes and puts the rest under "Show all N homes"', () => {
    const html = renderMatrixHtml({
      id: 'did-not-sell',
      family: 'unsold',
      heading: 'x',
      entries: [subjectEntry, ...unsold(5)],
    })
    const stack = html.slice(html.indexOf('class="comp-stack"'))
    expect(stack).toContain('data-matrix="did-not-sell"')
    expect(stack).toContain(`<details class="comp-more" data-visible="${STACK_OPEN_CARDS}">`)
    expect(stack).toContain('<summary class="comp-more-s">Show all 5 homes</summary>')
    // Nothing is removed: every home still has its card, your own first.
    expect(stack.match(/<article class="comp-stack-card/g)).toHaveLength(6)
    const before = stack.slice(0, stack.indexOf('<details'))
    expect(before.match(/<article class="comp-stack-card/g)).toHaveLength(1 + STACK_OPEN_CARDS)
    expect(before).toContain('is-yours')
    expect(before).toContain('data-comp="i"')
    expect(before).toContain('data-comp="ii"')
    expect(before).not.toContain('data-comp="iii"')
    // A <details> needs no script, and print never draws the phone cards.
    const css = immersiveStylesheet()
    expect(css).toMatch(/@media print\{\.comp-stack\{display:none!important\}/)
    expect(css).toContain('details.comp-more[open]>summary{display:none}')
  })

  it('does not fold a list of three homes or fewer', () => {
    expect(stackFoldHtml(['<a/>', '<b/>', '<c/>'])).toBe('<a/><b/><c/>')
    expect(stackFoldHtml(['<a/>', '<b/>', '<c/>', '<d/>'])).toContain('Show all 4 homes')
  })
})

describe('the sort control a homeowner can read (2e)', () => {
  it('is called Sort, opens on Our order, and keeps every other order', () => {
    const js = immersiveInteractionScript()
    expect(js).not.toContain('As printed')
    expect(js).toContain("['Our order',null,1]")
    expect(js).toContain("el('label','rr-lbl','Sort')")
    for (const o of ['Most recent', 'Price today', 'Size', 'Days on market']) expect(js).toContain(`'${o}'`)
  })

  it('sorts each matrix on its own and keeps the phone fold in step', () => {
    const js = immersiveInteractionScript()
    expect(js).toContain('function orderOne(matrix,key,dir)')
    expect(js).toContain("container.children[c].classList.contains('comp-more')")
    // A pin tapped on a phone opens the fold its card sits under.
    expect(js).toContain('if(fold&&!fold.open)fold.open=true')
  })
})

// ── the sales chapter ────────────────────────────────────────────────────────

const broker: CmaBroker = {
  id: null,
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201212071',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/matt-ryan.png',
}

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220214213',
  streetAddress: '20513 Byron',
  city: 'Bend',
  state: 'OR',
  postalCode: '97702',
  subdivision: 'Stone Creek',
  latitude: null,
  longitude: null,
  beds: 4,
  baths: 3,
  sqft: 2222,
  lotAcres: 0.1,
  propertySubType: null,
  yearBuilt: 2018,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/hero.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Canceled',
  lastListPrice: 659000,
  lastListDate: '2026-05-01',
  listingHistoryLine: null,
}

function sale(i: number, over: Partial<CmaAdjustedComp> = {}): CmaAdjustedComp {
  const close = 600000 + i * 10000
  return {
    listingKey: `C${i}`,
    mlsNumber: String(i),
    address: `${61590 + i} Lorenzo`,
    city: 'Bend',
    subdivision: 'Stone Creek',
    latitude: null,
    longitude: null,
    beds: 4,
    baths: 3,
    sqft: 2200,
    lotAcres: 0.1,
    propertySubType: null,
    yearBuilt: 2019,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: close + 5000,
    closePrice: close,
    closeDate: `2026-0${(i % 8) + 1}-10`,
    daysToOffer: 7,
    domTotal: 30 + i,
    selectionTier: 'subdivision',
    monthsSinceClose: 2,
    timeAdjustment: 1000,
    timeAdjustedPrice: close + 1000,
    ppsfTimeAdjusted: 279,
    sizeAdjustment: 500,
    adjustedPrice: close + 1500,
    weight: 1,
    ...over,
  } as CmaAdjustedComp
}

// Six sales; the pricing unit sets the sixth aside, so five set the price.
const comps = [
  sale(1, { concessionsAmount: 12000 } as Partial<CmaAdjustedComp>),
  sale(2),
  sale(3),
  sale(4),
  sale(5),
  sale(6),
]
const pricing = {
  method1Low: 610000,
  method1Mid: 630000,
  method1High: 650000,
  method2: 630000,
  method3: 630000,
  convergenceSpreadPct: 1,
  converged: true,
  conservative: 610000,
  recommended: 629000,
  highEnd: 650000,
  valueLow: 611500,
  valueHigh: 651500,
  confidence: 'High',
  confidenceReason: 'x',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.02,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
  setAside: [{ listingKey: 'C6', address: '61596 Lorenzo', reason: 'The highest of these sales.' }],
  reconciliation: {
    sentence: '61591 Lorenzo carries the most weight.',
    weights: [
      { listingKey: 'C1', weight: 31.9, grossAdjustmentPct: 2.1 },
      { listingKey: 'C2', weight: 14.2, grossAdjustmentPct: 1.1 },
      { listingKey: 'C3', weight: 15.1, grossAdjustmentPct: 1.0 },
      { listingKey: 'C4', weight: 27.3, grossAdjustmentPct: 0.9 },
      { listingKey: 'C5', weight: 11.5, grossAdjustmentPct: 0.8 },
    ],
  },
} as unknown as CmaPricing

function docArgs(): RenderCmaArgs & { broker: CmaBroker } {
  return {
    subject,
    comps,
    market: null,
    pricing,
    broker,
    client: { name: null, email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-05T23:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
  } as unknown as RenderCmaArgs & { broker: CmaBroker }
}

function chapter(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`)
  if (start < 0) return ''
  const end = html.indexOf('<section', start + 1)
  return html.slice(start, end > 0 ? end : undefined)
}

describe('the sales at a glance (2a)', () => {
  it('prints one row per sale that set the price, and the count it prints is that count', () => {
    const rows = salesGlanceRows({ subject, comps, pricing })
    expect(rows.map((r) => r.key)).toEqual(['1', '2', '3', '4', '5'])
    const html = salesGlanceHtml({ subject, comps, pricing })
    expect(html).toContain('The five sales, at a glance')
    expect(html).toContain('data-glance-rows="5"')
    expect(html.match(/<tr data-comp=/g)).toHaveLength(5)
    // The set-aside sale is not one of the sales that set it.
    expect(html).not.toContain('61596 Lorenzo')
  })

  it('prints exactly the strings the matrix prints for the same sale', () => {
    const matrix = renderCompMatrixHtml(subject, comps, '', null, new Map([
      ['C1', { weight: 31.9, grossAdjustmentPct: 2.1 }],
      ['C2', { weight: 14.2, grossAdjustmentPct: 1.1 }],
      ['C3', { weight: 15.1, grossAdjustmentPct: 1.0 }],
      ['C4', { weight: 27.3, grossAdjustmentPct: 0.9 }],
      ['C5', { weight: 11.5, grossAdjustmentPct: 0.8 }],
    ]))
    // Six sales print as two tables of three, your home leading each, so the
    // row is read across every table it appears in.
    const cells = (label: string) =>
      [...matrix.matchAll(new RegExp(`<tr[^>]*><th>${label}</th>([\\s\\S]*?)</tr>`, 'g'))].flatMap((row) =>
        [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!).slice(1),
      )
    const sold = cells('Sold after concessions')
    const adjusted = cells('Adjusted')
    const weight = cells('Weight in this price')
    const rows = salesGlanceRows({ subject, comps, pricing })
    rows.forEach((r, i) => {
      expect(r.sold).toBe(sold[i])
      expect(r.adjusted).toBe(adjusted[i])
      expect(r.weight).toBe(weight[i])
    })
    // Sale 1 carried a $12,000 credit: $610,000 less it.
    expect(rows[0]!.sold).toBe('$598,000')
    expect(rows[0]!.weight).toBe('31.9%')
    // One sale carried a concession, so the column says what it holds.
    expect(salesGlanceHtml({ subject, comps, pricing })).toContain('>Sold after concessions</th>')
    const noCredit = comps.map((c) => ({ ...c, concessionsAmount: null }))
    expect(salesGlanceHtml({ subject, comps: noCredit, pricing })).toMatch(/scope="col" class="n">Sold<\/th>/)
  })

  it('leads the web chapter, with the status table moved under the sales behind one tap', () => {
    const a = docArgs()
    const web = chapter(renderImmersiveCmaHtml(a, 'https://ryan-realty.com'), 'sales-that-set-it')
    const glanceAt = web.indexOf('class="sales-glance"')
    const matrixAt = web.indexOf('comp-matrix is-closed')
    const boardAt = web.indexOf('data-status-price="board"')
    expect(glanceAt).toBeGreaterThan(0)
    expect(matrixAt).toBeGreaterThan(glanceAt)
    expect(boardAt).toBeGreaterThan(matrixAt)
    expect(web).toMatch(/<details class="status-price-more"><summary class="status-price-s">(All \d+ homes by status|The one home in this report, by status)<\/summary>/)
    expect(web).not.toContain('<details class="status-price-more" open')
    // The letter keeps its own order: the board first, no disclosure.
    const { html: letter } = renderCmaHtml(a)
    const letterChapter = letter.slice(letter.indexOf('The sales that set this price.'))
    expect(letterChapter.indexOf('data-status-price="board"')).toBeLessThan(letterChapter.indexOf('comp-matrix is-closed'))
    expect(letter).not.toContain('status-price-more')
    expect(letter).not.toContain('sales-glance')
    // No seller word the documents ban.
    expect(findSellerBannedWords(web)).toEqual([])
  })
})

describe('the status table disclosure', () => {
  it('names the homes it holds, off the board itself', () => {
    const board = statusPriceBoardHtml(
      statusPriceSummaries({
        closed: [entry({ key: '1', family: 'closed', closePrice: 600000 }), entry({ key: '2', family: 'closed', closePrice: 610000 })],
        unsold: unsold(3),
      }),
    )
    expect(statusPriceBoardHomes(board)).toBe(5)
    const details = statusPriceBoardDisclosureHtml(board)
    expect(details).toContain('All 5 homes by status')
    expect(details).toContain(board)
    expect(statusPriceBoardDisclosureHtml('')).toBe('')
  })
})

// ── the map ──────────────────────────────────────────────────────────────────

describe('pins that touch step aside, and the reader\'s home stays put (3)', () => {
  it('separates a knot of pins without moving the fixed one', () => {
    const pts = [
      { xPct: 50, yPct: 50 },
      { xPct: 50.5, yPct: 50.2 },
      { xPct: 49.6, yPct: 50.4 },
      { xPct: 50.2, yPct: 49.5 },
      { xPct: 50, yPct: 50 },
      null,
    ]
    const frame = { width: 339, height: 424, separation: 29 }
    const placed = relaxPins(pts, [true, false, false, false, false, false], frame)
    expect(placed[5]).toBeNull()
    expect(placed[0]!.xPct).toBe(50)
    expect(placed[0]!.yPct).toBe(50)
    expect(placed[0]!.moved).toBe(false)
    const px = placed.filter(Boolean).map((p) => ({ x: (p!.xPct / 100) * 339, y: (p!.yPct / 100) * 424 }))
    for (let a = 0; a < px.length; a++) {
      for (let b = a + 1; b < px.length; b++) {
        expect(Math.hypot(px[a]!.x - px[b]!.x, px[a]!.y - px[b]!.y)).toBeGreaterThan(28.5)
      }
    }
    // Each pin remembers its house, and one that moved far says so.
    expect(placed[4]!.anchorXPct).toBe(50)
    expect(placed.slice(1, 5).some((p) => p!.moved)).toBe(true)
    // Deterministic: the same document draws the same map.
    expect(relaxPins(pts, [true, false, false, false, false, false], frame)).toEqual(placed)
  })

  it('crops the phone view to the pins, shaped for a phone, and never past them', () => {
    const pts = [
      { xPct: 46.8, yPct: 27.7 },
      { xPct: 50.9, yPct: 29.4 },
      { xPct: 60.1, yPct: 12.8 },
      { xPct: 39.9, yPct: 87.2 },
    ]
    const crop = phoneCrop(pts, { imageAspect: 640 / 360 })
    expect(crop.w).toBeLessThan(1)
    for (const p of pts) {
      const c = intoCrop(p, crop)
      expect(c.xPct).toBeGreaterThan(0)
      expect(c.xPct).toBeLessThan(100)
      expect(c.yPct).toBeGreaterThan(0)
      expect(c.yPct).toBeLessThan(100)
    }
    const aspect = (crop.w * 640) / (crop.h * 360)
    expect(aspect).toBeGreaterThanOrEqual(0.8 - 1e-9)
    // Homes spread edge to edge are shown whole.
    expect(phoneCrop([{ xPct: 2, yPct: 3 }, { xPct: 98, yPct: 97 }], { imageAspect: 640 / 360 })).toEqual(FULL_CROP)
  })

  it('stamps both layouts on every pin and the crop on the frame, and keeps the subject on top', () => {
    const facts = [
      { key: '1', family: 'closed' as const, address: '12 Pine', outcome: 'sold $457K', domDays: 31, priceChanges: 0 },
      { key: 'i', family: 'unsold' as const, address: '56 Fir', outcome: 'came off after 36 days', domDays: 36, priceChanges: 1 },
      { key: 'A', family: 'active' as const, address: '34 Oak', outcome: 'asking $417K', domDays: 13, priceChanges: 0 },
    ]
    const html = renderCompPinMapHtml({
      subject: { streetAddress: '850 Quince', latitude: 44.272, longitude: -121.174 },
      facts,
      mapDataUri: 'data:image/svg+xml;base64,AAAA',
      overlay: {
        view: { centerLat: 44.2726, centerLng: -121.1745, zoom: 15, width: 640, height: 360 },
        pins: [
          { key: null, family: 'subject', lat: 44.272, lng: -121.174 },
          { key: '1', family: 'closed', lat: 44.27201, lng: -121.17401 },
          { key: 'i', family: 'unsold', lat: 44.27199, lng: -121.17399 },
          { key: 'A', family: 'active', lat: 44.2722, lng: -121.1738 },
        ],
      } as never,
    })
    expect(html).toContain('class="pin-map-frame"')
    expect(html).toMatch(/style="--cx:[\d.]+;--cy:[\d.]+;--cw:[\d.]+;--ch:[\d.]+;--car:[\d.]+"/)
    expect(html).toContain('<div class="pin-map-clip"><img class="pin-map"')
    // Every pin carries its phone place, and every pin still keys its row.
    for (const key of ['subject', '1', 'i', 'A']) {
      expect(html).toMatch(new RegExp(`data-pin="${key}"[^>]*style="left:[\\d.]+%;top:[\\d.]+%;--px:[\\d.]+%;--py:[\\d.]+%"`))
    }
    // Three pins on one house: the two that stepped aside draw their way home.
    expect(html).toContain('class="pin-leaders is-wide"')
    expect(html).toContain('class="pin-leaders is-phone"')
    const css = immersiveStylesheet()
    expect(css).toContain('.pin-map-frame .pin-hit{left:var(--px)!important;top:var(--py)!important}')
    expect(css).toContain('.pin-hit.is-subject{z-index:2}')
    // A listing that came off is a dashed ring, not a numeral struck through.
    expect(css).toContain('.pin-hit.is-unsold .pin-dot{box-shadow:0 0 0 2px var(--cream),0 1px 6px rgba(16,39,66,.25);border:2px dashed var(--navy)}')
    expect(css).toContain('.pin-legend .is-unsold .pl-k{box-shadow:none;border:1.5px dashed var(--navy)}')
    expect(css).not.toMatch(/\.pin-hit\.is-unsold \.pin-dot::after\{content:''/)
  })

  it('keeps the subject where the house is on both layouts', () => {
    const layout = layoutCompPins(
      [{ xPct: 46.77, yPct: 27.72 }, { xPct: 46.8, yPct: 27.8 }, { xPct: 47, yPct: 27.6 }],
      [true, false, false],
      640 / 360,
    )
    expect(layout.wide[0]!.xPct).toBeCloseTo(46.77, 6)
    const phoneSubject = intoCrop({ xPct: 46.77, yPct: 27.72 }, layout.crop)
    expect(layout.phone[0]!.xPct).toBeCloseTo(phoneSubject.xPct, 6)
    expect(layout.phone[0]!.yPct).toBeCloseTo(phoneSubject.yPct, 6)
  })

  it('draws a listing that came off as a dashed ring when there is no tile either', () => {
    const html = renderCompPinMapHtml({
      subject: { streetAddress: '850 Quince', latitude: 44.272, longitude: -121.174 },
      facts: [
        { key: 'i', family: 'unsold', address: '56 Fir', outcome: 'came off', domDays: 36, priceChanges: 1, latitude: 44.2705, longitude: -121.1765 },
      ],
    })
    expect(html).toContain('stroke-dasharray="4 3"')
  })
})

describe('the hero fits the first screen of a laptop (1)', () => {
  it('lays the photo over a band and the title block under it, sized to the screen', () => {
    const css = immersiveStylesheet()
    expect(css).toContain('@media screen and (min-width:701px){\n  .sc.hero{display:grid')
    expect(css).toMatch(/\.sc\.hero\{[^}]*height:100svh[^}]*max-height:calc\(66\.67vw \+ 340px\)/)
    // F3 holds: the photo is contained, never cropped, with its blurred bed.
    expect(css).toMatch(/\.hero-img\{position:relative;[^}]*object-fit:contain/)
    expect(css).toContain('.hero-bed{position:absolute')
  })
})
