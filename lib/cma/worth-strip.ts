/**
 * Chapter 3's own conclusion, drawn.
 *
 * tasteReview 2026-09-07, item 2: "Chapter 3 is the point of the document and
 * it has no graphic of its own conclusion — it goes headline, four paragraphs
 * of method, then a twelve-row spreadsheet. Draw the five adjusted prices as a
 * dot strip with the range shaded and the recommended list marked, above the
 * grid, so one glance lands 'here is where five real sales put your house, and
 * here is where we would list it.'"
 *
 * ONE price axis. Every printed sale is a dot at its sale-price-today, the
 * worth range is the shaded strip under them, the recommended list is the one
 * full-navy mark, and on a listing that failed the ask that failed is a hollow
 * mark beside it — which is the same reading chapter 1 draws against time,
 * drawn here against the evidence.
 *
 * Nothing here computes a valuation. Every figure is already printed in the
 * grid below it (`adjustedPrice` per sale) or on the pricing row
 * (`valueLow` / `valueHigh` / `recommended`), so a reader can check every mark
 * against a number on the same screen (CLAUDE.md §0).
 */

import { escapeHtml, int, usd } from '@/lib/cma/render-blocks'

const esc = escapeHtml

const INK = '#102742'
const MUTED = 'rgba(16,39,66,0.55)'
const EDGE = 'rgba(16,39,66,0.22)'
const ZONE = 'rgba(16,39,66,0.16)'

/** The one word a hollow mark needs. Clamped to the frame like every label. */
const ASIDE_LABEL = 'set aside'

/**
 * The hit band's height in SVG UNITS, not pixels.
 *
 * A 44-unit band on a 360-unit drawing rendered into a 335px column measures
 * 41px — three short of the target it was built to hit (tasteReview round
 * three, §2 item 4). The drawing is scaled to its column, so the unit has to
 * carry the scale: 48 units is 44.7px at that width and more on anything
 * wider. `scripts/cma-lookpass.ts` measures the rendered box and fails under
 * 44, so this cannot silently drift back.
 */
const HIT_UNITS = 48

export type WorthStripSale = {
  n: number
  address: string
  adjustedPrice: number
  /**
   * True when `pricing.rangeRule` set this sale aside — the highest and the
   * lowest, under `trimmed-one-each-end`. It is still one of the sales the
   * grid prints; it is not one of the sales the RANGE is the spread of.
   */
  setAside?: boolean
}

export type WorthStripInput = {
  /** One dot per printed sale, in the grid's own order. */
  sales: WorthStripSale[]
  rangeLow: number
  rangeHigh: number
  recommended: number
  /** The ask that FAILED, on a listing that came off unsold. Null otherwise. */
  lastAsk: number | null
  /**
   * The document's own n — how many sales the price is over.
   *
   * Passed in rather than counted here so the caption, chapter 3's lead,
   * chapter 5's "sales behind your price" and the set-aside list under the
   * grid are one number (round-four class E: 19968 printed six, four and two
   * for one set). Omitted, it falls back to the kept dots on the drawing.
   */
  keptCount?: number | null
}

export type WorthStripLayout = { width: number; height: number; fontSize: number }

export const WORTH_STRIP_WIDE: WorthStripLayout = { width: 720, height: 182, fontSize: 12 }
export const WORTH_STRIP_PHONE: WorthStripLayout = { width: 360, height: 206, fontSize: 11 }

/** $475K. A price axis is read at a glance, not audited — the grid audits it. */
function shortUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(2)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

type Geometry = {
  lo: number
  hi: number
  low: number
  high: number
  /** Drawn as filled dots: every kept sale, plus any set-aside one on the axis. */
  sales: WorthStripSale[]
  /** Set aside AND off the axis — named in the caption, never drawn. */
  offAxis: WorthStripSale[]
}

/**
 * THE AXIS IS THE KEPT SALES, THE LIST LINE AND THE FAILED ASK. Nothing else
 * sets its width.
 *
 * tasteReview round two, §3.G: on 65365 Concorde the two sales the prose says
 * were set aside ($971K and $2.65M) set the width of the whole drawing and
 * carried the only two dollar labels on it, so the first read of the graphic
 * was "worth somewhere between $971K and $2.65M" — over a range of $1.26M to
 * $1.75M that went unlabelled. On 19968 a $140,000 figure from an old listing
 * sat at the far left with every dot clustered $296K to $441K, and 40 percent
 * of the strip was empty. A set-aside sale is drawn hollow, with its own small
 * label, ONLY when it lands inside that axis; otherwise the caption names it
 * and the drawing keeps its scale.
 */
export function worthStripGeometry(input: WorthStripInput): Geometry | null {
  const all = input.sales
    .filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
    .sort((a, b) => a.adjustedPrice - b.adjustedPrice)
  const kept = all.filter((s) => s.setAside !== true)
  if (kept.length < 2) return null
  const low = Math.min(input.rangeLow, input.rangeHigh)
  const high = Math.max(input.rangeLow, input.rangeHigh)
  if (!(low > 0) || !(high > 0) || !(input.recommended > 0)) return null
  const values = [
    ...kept.map((s) => s.adjustedPrice),
    low,
    high,
    input.recommended,
    ...(input.lastAsk != null && input.lastAsk > 0 ? [input.lastAsk] : []),
  ]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.12, Math.max(max * 0.01, 1))
  const lo = min - pad
  const hi = max + pad
  const setAside = all.filter((s) => s.setAside === true)
  const inside = setAside.filter((s) => s.adjustedPrice >= lo && s.adjustedPrice <= hi)
  const offAxis = setAside.filter((s) => s.adjustedPrice < lo || s.adjustedPrice > hi)
  const sales = [...kept, ...inside].sort((a, b) => a.adjustedPrice - b.adjustedPrice)
  return { lo, hi, low, high, sales, offAxis }
}

/** "One sale at $2.65M was set aside." Only when one was, and it is off-axis. */
function setAsideNote(g: Geometry): string {
  if (g.offAxis.length === 0) return ''
  const prices = g.offAxis.map((s) => shortUsd(s.adjustedPrice))
  if (prices.length === 1) return `One sale at ${prices[0]} was set aside.`
  const list = `${prices.slice(0, -1).join(', ')} and ${prices[prices.length - 1]}`
  return `${prices.length} sales, at ${list}, were set aside.`
}

/**
 * Keep a label's own box inside the frame. Geist runs about 0.58em per
 * character at these sizes; deliberately generous, because a label that ends
 * three units early is invisible and one that ends three units late is a
 * clipped word.
 */
function fit(
  cx: number,
  label: string,
  fontSize: number,
  W: number,
): { x: string; anchor: 'start' | 'middle' | 'end' } {
  const half = (label.length * fontSize * 0.58) / 2
  if (cx - half < 1) return { x: '1', anchor: 'start' }
  if (cx + half > W - 1) return { x: (W - 1).toFixed(1), anchor: 'end' }
  return { x: cx.toFixed(1), anchor: 'middle' }
}

export function worthStripSvg(
  input: WorthStripInput,
  layout: WorthStripLayout = WORTH_STRIP_WIDE,
): string {
  const g = worthStripGeometry(input)
  if (!g) return ''
  const { width: W, height: H, fontSize: fs } = layout
  const drawnKept = g.sales.filter((s) => s.setAside !== true).length
  const keptCount =
    input.keptCount != null && Number.isFinite(input.keptCount) && input.keptCount > 0
      ? Math.round(input.keptCount)
      : drawnKept
  const left = 10
  const right = W - 10
  // The shaded strip sits low in the frame; the marks that name themselves sit above
  // it, and the axis numbers under it. Three rows, no collisions.
  const zoneTop = H - 92
  const zoneBottom = H - 64
  const dotY = zoneTop - 16
  const x = (v: number) => left + ((right - left) * (v - g.lo)) / Math.max(g.hi - g.lo, 1)

  // Dots. Only the two ends carry a number — five prices along 700 units with
  // a label each is unread chaos (dataviz skill, step 4). Every dot names
  // itself on tap, and the grid below prints all five.
  //
  // The tap target is 26 units, not 44: five sales inside three percent of
  // each other are a DENSE SERIES, and 44px targets on a phone would overlap
  // so completely that only the last dot could be reached. The dataviz skill's
  // floor for a mark is 24px, the look-pass holds these to it, and every one
  // of these five prices is also a row in the grid below, which is the 44px
  // path to the same reading.
  // THE TARGET IS A BAND, not a circle. Five sales inside three percent of
  // each other cannot each carry a 44px circle — the neighbours' targets
  // overlap and only the last dot is reachable, which is why this was 26 units
  // wide. So the target grows in the dimension that was failing: as wide as
  // the gap to the nearest neighbour, 44 units tall (tasteReview round two,
  // item 3). Every one of these prices is also a 44px row in the grid below.
  // Sales priced within a whisker of each other STACK rather than merge. Three
  // sales inside $2,000 drew one solid blob at 375 and the reader lost two of
  // them; a dot that steps up a row is still on the same price, and the axis
  // is horizontal so the row it sits in carries no meaning of its own.
  const cxs = g.sales.map((s) => x(s.adjustedPrice))
  const rows: number[] = new Array(cxs.length).fill(0)
  {
    // Packed left to right, so a row's last dot is always the nearest one in
    // it: the first row with 11 units of clearance takes the dot.
    const lastInRow: number[] = []
    const order = cxs.map((_, i) => i).sort((a, b) => cxs[a]! - cxs[b]!)
    for (const i of order) {
      let r = 0
      while (r < lastInRow.length && cxs[i]! - lastInRow[r]! < 11) r++
      lastInRow[r] = cxs[i]!
      rows[i] = r
    }
  }
  // THE TARGET IS A BAND, not a circle. Five sales inside three percent of
  // each other cannot each carry a 44-unit circle — the neighbours' targets
  // overlap and only the last dot is reachable, which is why this was 26 units
  // across. So the target grows in the dimension that was failing: 44 units
  // tall, and no wider than the gap to the nearest dot (tasteReview round two,
  // item 3). Every one of these prices is also a 44px row in the grid below.
  const hitWidth = (i: number): number => {
    const near = Math.min(
      i > 0 ? cxs[i]! - cxs[i - 1]! : Infinity,
      i < cxs.length - 1 ? cxs[i + 1]! - cxs[i]! : Infinity,
    )
    return Math.max(Math.min(Number.isFinite(near) ? near : 44, 44), 26)
  }
  // The two axis-end labels' own boxes, so the set-aside word can be tested
  // against where they actually print rather than against a price.
  const labelHalf = (t: string, size: number) => (t.length * size * 0.58) / 2
  const asideHalf = labelHalf(ASIDE_LABEL, fs - 1)
  const endSpans: Array<[number, number]> = [g.low, g.high].map((v) => {
    const half = labelHalf(shortUsd(v), fs)
    return [x(v) - half, x(v) + half]
  })
  const labelWouldSitOnAnAxisEnd = (cx: number): boolean =>
    endSpans.some(([lo, hi]) => cx + asideHalf >= lo - 2 && cx - asideHalf <= hi + 2)

  const topRow = Math.max(0, ...rows)
  // The stack has a ceiling: seven sales inside a whisker of each other would
  // otherwise climb straight out of the frame. The step tightens instead.
  const step = topRow > 0 ? Math.min(13, (dotY - 34) / topRow) : 13
  // Above the TALLEST stack, never above row zero: a label that clears one dot
  // and sits on the next one is the collision it was moved to avoid.
  const labelY = dotY - topRow * step - 12
  // "set aside" gets its own row ABOVE the two price labels. Beside the dot it
  // landed on the end price label whenever the set-aside sale was near an end,
  // which on 19968 it is by construction.
  const asideLabelY = labelY - (fs + 2)
  const dots = g.sales
    .map((s, i) => {
      const cx = cxs[i]!
      const cy = dotY - rows[i]! * step
      const aside = s.setAside === true
      // THE AXIS END WINS (round-four class E). On 19968 the set-aside sale is
      // $479,614 against a stated worth top of $479,000 — one point on the
      // drawing, wearing the bold "$479K" the chapter concluded with and the
      // word "set aside" directly above it. A reader takes the two together
      // and reads "the top of what your home is worth was set aside".
      //
      // The test is the one the eye applies: does the word land over an axis
      // end's own label? Not equality of the two prices — they were never
      // equal on the row that produced the defect, and $614 of difference is
      // three tenths of a pixel. The axis label is the chapter's own
      // conclusion and it stays; the dot stays hollow, which is what says
      // "not one of the sales the range is the spread of", and the reason is
      // in the named list under the grid.
      const onAxisEnd = aside && labelWouldSitOnAnAxisEnd(cx)
      const read = `${s.n}. ${s.address} · sale price today ${usd(s.adjustedPrice)}${
        aside ? ' · set aside from the range' : ''
      }`
      // A COUNTED SALE AND A SET-ASIDE ONE ARE NOT THE SAME MARK. The set-aside
      // one is hollow and carries its own small label, so a reader never counts
      // a sale the range was not the spread of (tasteReview round two, §3.G).
      const asideFit = fit(cx, ASIDE_LABEL, fs - 1, W)
      const mark = aside
        ? `<circle class="ws-aside" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="none" stroke="${INK}" stroke-width="1.5"/>${
            onAxisEnd
              ? ''
              : `
      <text x="${asideFit.x}" y="${asideLabelY.toFixed(1)}" text-anchor="${asideFit.anchor}" font-size="${(fs - 1).toFixed(1)}" fill="${MUTED}">${ASIDE_LABEL}</text>`
          }`
        : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${INK}"/>`
      return `<g class="ws-dot${aside ? ' is-aside' : ''}" data-comp="${s.n}" data-pin="${s.n}" data-read="${esc(read)}" tabindex="0" role="button" aria-label="${esc(read)}">
      <rect x="${(cx - hitWidth(i) / 2).toFixed(1)}" y="${(cy - HIT_UNITS / 2).toFixed(1)}" width="${hitWidth(i).toFixed(1)}" height="${HIT_UNITS}" fill="transparent"/>
      ${mark}
    </g>`
    })
    .join('\n    ')
  // THE AXIS LABELS ARE THE TWO NUMBERS THE CHAPTER SAYS THE HOME IS WORTH.
  //
  // They used to be the outermost DOTS, so 19968 labelled $322K and $480K over
  // a chapter that had just said $331,000 to $479,000, and 1617 NW 8th
  // $675K/$898K against $696,000–$926,000 (tasteReview round three, §2 item
  // 3). The two numbers a reader's eye lands on were not the two numbers the
  // document states. They are now the ends of the shaded zone, which is what
  // they sit over.
  const endLabel = (v: number, side: 'low' | 'high', pushOut: boolean) => {
    const label = shortUsd(v)
    const f = fit(x(v), label, fs, W)
    // When the zone is narrow the pair would print through each other, so they
    // step OUTWARD rather than onto a second line: a range label that leaves
    // the end it belongs to has stopped labelling anything.
    const anchor = pushOut ? (side === 'low' ? 'end' : 'start') : f.anchor
    const cx = pushOut ? Math.min(Math.max(x(v), 1), W - 1).toFixed(1) : f.x
    return `<text x="${cx}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(label)}</text>`
  }
  // Their own boxes, to decide whether they collide at all.
  const zoneLabelsCollide =
    Math.abs(x(g.high) - x(g.low)) <
    (shortUsd(g.low).length + shortUsd(g.high).length) * fs * 0.58 * 0.5 + 6

  // The two vertical marks label themselves on ONE line under the axis. They
  // used to sit on two lines five units apart with the zone caption between
  // them, and "asked $1.50M" printed straight through "what it is worth".
  const recX = x(input.recommended)
  const recLabel = `list ${shortUsd(input.recommended)}`
  const recFit = fit(recX, recLabel, fs, W)
  const ask = input.lastAsk != null && input.lastAsk > 0 ? input.lastAsk : null
  const askX = ask != null ? x(ask) : 0
  const askLabel = ask != null ? `asked ${shortUsd(ask)}` : ''
  const askFit = ask != null ? fit(askX, askLabel, fs, W) : null
  const markY = zoneBottom + 16
  // A second line only when the two labels' own boxes would collide.
  // THE TWO MARKS' OWN BOXES, after anchoring, not their centres.
  //
  // On Concorde "list $1.47M" and "asked $1.50M" print 2 percent apart on a 39
  // percent axis, and the one mark carrying the recommendation was illegible
  // (tasteReview round three, §2 item 3). A centre-distance test misses the
  // case where `fit` has already clamped one of them to the frame, so the
  // boxes themselves are compared and the SECOND label drops a line.
  const wide = (t: string) => t.length * fs * 0.58
  const box = (
    f: { x: string; anchor: 'start' | 'middle' | 'end' },
    t: string,
  ): [number, number] => {
    const at = Number(f.x)
    const w = wide(t)
    if (f.anchor === 'start') return [at, at + w]
    if (f.anchor === 'end') return [at - w, at]
    return [at - w / 2, at + w / 2]
  }
  const askDrops = (() => {
    if (ask == null || !askFit) return false
    const [a0, a1] = box(askFit, askLabel)
    const [r0, r1] = box(recFit, recLabel)
    return a0 < r1 + 6 && r0 < a1 + 6
  })()
  const askY = askDrops ? markY + fs + 4 : markY

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Where the sales put this home, and where we would list it" class="trend-svg worth-strip">
    <text x="${left}" y="14" font-size="${fs}" fill="${MUTED}">One scale: sale price today. ${int(
      keptCount,
    )} sales.</text>
    <rect x="${x(g.low).toFixed(1)}" y="${zoneTop.toFixed(1)}" width="${Math.max(x(g.high) - x(g.low), 2).toFixed(1)}" height="${(zoneBottom - zoneTop).toFixed(1)}" fill="${ZONE}" stroke="${INK}" stroke-opacity="0.45" stroke-width="1"/>
    <line x1="${left}" y1="${zoneBottom.toFixed(1)}" x2="${right}" y2="${zoneBottom.toFixed(1)}" stroke="${EDGE}" stroke-width="0.75"/>
    ${
      ask != null
        ? `<line x1="${askX.toFixed(1)}" y1="${(zoneTop - 30).toFixed(1)}" x2="${askX.toFixed(1)}" y2="${zoneBottom.toFixed(1)}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="3 3"/>
    <text x="${askFit!.x}" y="${askY.toFixed(1)}" text-anchor="${askFit!.anchor}" font-size="${fs}" fill="${MUTED}">${esc(askLabel)}</text>`
        : ''
    }
    <line x1="${recX.toFixed(1)}" y1="${(zoneTop - 30).toFixed(1)}" x2="${recX.toFixed(1)}" y2="${zoneBottom.toFixed(1)}" stroke="${INK}" stroke-width="2"/>
    <text x="${recFit.x}" y="${markY.toFixed(1)}" text-anchor="${recFit.anchor}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(recLabel)}</text>
    ${dots}
    ${endLabel(g.low, 'low', zoneLabelsCollide)}
    ${g.high !== g.low ? endLabel(g.high, 'high', zoneLabelsCollide) : ''}
    <text x="${left}" y="${(H - 4).toFixed(1)}" font-size="${fs}" fill="${INK}">The shading is what your home is worth</text>
  </svg>`
}

export function worthStripPhoneSvg(input: WorthStripInput): string {
  return worthStripSvg(input, WORTH_STRIP_PHONE)
}

/**
 * The reading under the strip. It says what the MARKS are and stops.
 *
 * tasteReview round two, §1 Words: this sentence printed the span of the
 * adjusted sales to the dollar, which was the chapter's third statement of a
 * range inside ten lines, and then repeated "The shading is what your home is
 * worth" verbatim from the caption drawn 20px above it. The range is stated
 * once, in the chapter's lead; the caption is on the drawing, where print can
 * read it; and this line does the one job neither of those does, which is to
 * say what a dot is.
 */
export function worthStripReading(input: WorthStripInput): string {
  const g = worthStripGeometry(input)
  if (!g) return ''
  const aside = setAsideNote(g)
  return `Each dot is one sale, moved to what it would sell for today. The line is where we would list it.${
    aside ? ` ${aside}` : ''
  }`
}

/**
 * Both layouts, wrapped so exactly one is ever visible — the wide drawing on
 * paper and at reading width, the fitted one below 700px. Nothing a seller
 * reads sits in a pan box (blueprint § The register).
 */
export function worthStripHtml(input: WorthStripInput): string {
  const wide = worthStripSvg(input, WORTH_STRIP_WIDE)
  if (!wide) return ''
  const phone = worthStripSvg(input, WORTH_STRIP_PHONE)
  const reading = worthStripReading(input)
  return `<div class="szn worth-wide">${wide}</div>
  ${phone ? `<div class="szn worth-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}`
}
