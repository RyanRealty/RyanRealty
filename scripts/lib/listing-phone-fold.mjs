/**
 * listing-phone-fold.mjs: the pure core of ci:listing-phone-fold
 * (scripts/check-listing-phone-fold.mjs).
 *
 * WHAT IT HOLDS. PR #386 (880d8453f, Matt 2026-09-25: "I hate all the wasted
 * space") fixed the listing page's first screen on a phone. At 375x812 the
 * photo frame had been a fixed 448px navy box (min(62dvh, 28rem)) with a 3:2
 * still contained in it: 99px of empty navy above the photo and 99px below,
 * and the street address drawn at display-1 over two lines. #386 made the
 * phone frame the photograph's own shape (3:2 by default, the lead still's
 * shape once it decodes, clamped 4:3 to 16:9 by listingFrameAspect, 16:9 when
 * a reel leads) with cover fit, and drew the address at display-2. The static
 * gate ci:listing-fold-density pins the CSS text of that fix; this module
 * judges the RENDERED page, measured by the runtime gate, so a change that
 * brings the dead space back by any route (a new wrapper, a token, a
 * component) fails.
 *
 * Every function here is pure over measured boxes ({x, y, w, h} in CSS px,
 * viewport coordinates at scrollY 0), so each rule is unit-tested in
 * listing-phone-fold.test.mjs without a browser.
 *
 * NAMES ON THE PAGE (components/site/listing-detail/PriceCtaStrip.tsx):
 *   h1.listing-ask          the street address (the page's H1)
 *   .listing-ask__price     the headline price
 *   .listing-face__facts    beds / baths / sq ft (publishListingHeroKeyStats)
 *   .listing-frame__media   the hero media frame (ListingHero.tsx)
 *   .v3-dog-floater         Jax, fixed at the right edge, half the viewport
 *                           down (components/site/v3/V3DogFloater.css)
 */

export const LISTING_PHONE_FOLD_GATE = 'ci:listing-phone-fold'

/** iPhone-class portrait viewports. 375x812 is the one #386 was measured at. */
export const PHONE_VIEWPORTS = Object.freeze([
  Object.freeze({ name: '375x812', width: 375, height: 812 }),
  Object.freeze({ name: '390x844', width: 390, height: 844 }),
])

/**
 * The limits. Each carries where its number comes from; see
 * docs/MECHANICAL_GATES.md (the ci:listing-phone-fold row) for the founding
 * measurements.
 */
export const FOLD_LIMITS = Object.freeze({
  /**
   * The two empty-band limits were set by measuring main (880d8453f) on
   * 2026-09-30 with `--survey 16`: the four cases plus 16 more homes spread
   * across the listings sitemap, 20 homes x 2 viewports = 40 readings.
   *
   * Hero block (top of the screen to the bottom of the facts line): the
   * largest band on every one of the 40 readings was 10.0px, the air between
   * the chrome and the place trail (y 56..66). Limit = 10.0 + 30px margin.
   * It stays under half of the 99px navy bands #386 removed.
   */
  maxHeroBandPx: 40,
  /**
   * Anywhere in the first screen: the largest band was 50.9px (5 of 20
   * homes), the section break from the pills row's text to the "Facts"
   * heading when that break falls inside the fold; every other reading was
   * 19.9px. Limit = 50.9 + 13.1px margin (about a quarter), kept well under
   * the 99px band so a letterbox or a spacer of that size still fails here
   * even below the facts line.
   */
  maxDeadBandPx: 64,
  /**
   * The phone frame is at most 4:3 tall (listingFrameAspect's floor,
   * LISTING_FRAME_ASPECT_MIN) for a photograph, and 16:9 when a reel leads.
   * On main every photo frame measured between 16:9 and 1.45:1 and every
   * reel 16:9.
   */
  photoFrameMaxHeightPerWidth: 3 / 4,
  videoFrameMaxHeightPerWidth: 9 / 16,
  /** Sub-pixel rounding of aspect-ratio boxes. */
  frameTolerancePx: 1,
  /**
   * A photograph covers its phone frame (cover fit): 0.0px left empty on all
   * 32 photo-led readings on main; 2px absorbs rounding. #386's letterbox
   * left 198px.
   */
  maxUncoveredFramePx: 2,
  /**
   * Jax may overlap nothing of the price or the address. On main the nearest
   * he came was 184.0px from the price and 21.5px from the address (the
   * longest street address in the sitemap, at 390x844).
   */
  minJaxClearancePx: 0,
})

/** Smaller than this in either direction is not visible content (sr-only is 1x1). */
export const MIN_CONTENT_EDGE_PX = 2

// ── geometry ────────────────────────────────────────────────────────────────

const round1 = (n) => Math.round(n * 10) / 10

/** Intersection of two rects, or null when they do not overlap. */
export function intersectRect(a, b) {
  if (!a || !b) return null
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * One axis of CSS object-position resolved to px of free space. Computed
 * style reports percentages or lengths ("50% 100%"); keywords are accepted
 * too so a hand-written value in a test reads naturally.
 */
function resolvePositionToken(token, free, axis) {
  const t = String(token ?? '').trim().toLowerCase()
  const keyword = {
    x: { left: 0, center: 50, right: 100 },
    y: { top: 0, center: 50, bottom: 100 },
  }[axis]
  if (t in keyword) return (free * keyword[t]) / 100
  const pct = /^(-?[\d.]+)%$/.exec(t)
  if (pct) return (free * Number(pct[1])) / 100
  const px = /^(-?[\d.]+)(px)?$/.exec(t)
  if (px) return Number(px[1])
  return free / 2
}

/** "50% 100%" -> [x offset, y offset] in px, given the free space on each axis. */
export function parseObjectPosition(value, freeX, freeY) {
  const parts = String(value ?? '50% 50%').trim().split(/\s+/).filter(Boolean)
  let [xTok, yTok] = parts
  if (parts.length === 1) {
    // One keyword names one axis; the other centres.
    if (xTok === 'top' || xTok === 'bottom') [xTok, yTok] = ['center', xTok]
    else yTok = 'center'
  }
  return [resolvePositionToken(xTok, freeX, 'x'), resolvePositionToken(yTok, freeY, 'y')]
}

/**
 * Where a replaced image actually paints inside its box, clipped to the box.
 * A 3:2 still with object-fit: contain in a 375x448 box paints 375x250 with
 * 99px of box above and below it: that band is the "wasted space" #386 cut.
 * Returns null when the image has no intrinsic size (not loaded).
 */
export function paintedImageRect(box, natural, fit = 'fill', position = '50% 50%') {
  if (!box || !(box.w > 0 && box.h > 0)) return null
  const nw = Number(natural?.w)
  const nh = Number(natural?.h)
  if (!(nw > 0 && nh > 0)) return null
  let dw
  let dh
  switch (String(fit).trim()) {
    case 'contain': {
      const s = Math.min(box.w / nw, box.h / nh)
      dw = nw * s
      dh = nh * s
      break
    }
    case 'cover': {
      const s = Math.max(box.w / nw, box.h / nh)
      dw = nw * s
      dh = nh * s
      break
    }
    case 'none':
      dw = nw
      dh = nh
      break
    case 'scale-down': {
      const s = Math.min(1, Math.min(box.w / nw, box.h / nh))
      dw = nw * s
      dh = nh * s
      break
    }
    default:
      dw = box.w
      dh = box.h
  }
  const [ox, oy] = parseObjectPosition(position, box.w - dw, box.h - dh)
  return intersectRect({ x: box.x + ox, y: box.y + oy, w: dw, h: dh }, box)
}

/**
 * The vertical intervals of `band` that some rect covers, merged and sorted.
 * A rect counts only where it overlaps the band horizontally too: a carousel
 * slide parked off the right edge of the phone is not on the screen.
 */
export function verticalCoverage(rects, band) {
  const spans = []
  for (const r of rects ?? []) {
    if (!r || !(r.w >= MIN_CONTENT_EDGE_PX) || !(r.h >= MIN_CONTENT_EDGE_PX)) continue
    const hit = intersectRect(r, band)
    if (!hit || hit.w < MIN_CONTENT_EDGE_PX || hit.h <= 0) continue
    spans.push([hit.y, hit.y + hit.h])
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const [a, b] of spans) {
    const last = merged.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

/**
 * The tallest band of `band` in which no rect is drawn, including the band's
 * top and bottom edges. `{ px, from, to }`, px rounded to 0.1.
 */
export function largestVerticalGap(rects, band) {
  const covered = verticalCoverage(rects, band)
  let best = { px: 0, from: band.y, to: band.y }
  let cursor = band.y
  const consider = (from, to) => {
    if (to - from > best.px) best = { px: to - from, from, to }
  }
  for (const [a, b] of covered) {
    consider(cursor, a)
    cursor = Math.max(cursor, b)
  }
  consider(cursor, band.y + band.h)
  return { px: round1(best.px), from: round1(best.from), to: round1(best.to) }
}

/**
 * How far a box sits outside the first screen, in px (0 when fully inside).
 * The worst edge wins, and the edge is named, so a failure reads
 * "bottom 861px > fold 812px" rather than a bare number.
 */
export function outsideFold(box, viewport) {
  if (!box) return { px: Infinity, edge: 'absent' }
  const over = [
    { edge: 'bottom', px: box.y + box.h - viewport.height },
    { edge: 'top', px: -box.y },
    { edge: 'right', px: box.x + box.w - viewport.width },
    { edge: 'left', px: -box.x },
  ].sort((a, b) => b.px - a.px)[0]
  return over.px > 0.5 ? { px: round1(over.px), edge: over.edge } : { px: 0, edge: null }
}

/**
 * Signed clearance between a disc (Jax is a circle: border-radius 50%) and a
 * set of rects: the smallest distance from the disc's edge to any rect,
 * negative when the disc overlaps one (the depth of the overlap). Null when
 * there is nothing to clear.
 */
export function discClearance(disc, rects) {
  if (!disc || !(disc.w > 0 && disc.h > 0)) return null
  const cx = disc.x + disc.w / 2
  const cy = disc.y + disc.h / 2
  const r = Math.min(disc.w, disc.h) / 2
  let best = null
  for (const rect of rects ?? []) {
    if (!rect || !(rect.w > 0 && rect.h > 0)) continue
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const inside = cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h
    const d = inside ? 0 : Math.hypot(cx - nx, cy - ny)
    const clearance = inside ? -r : d - r
    if (best === null || clearance < best) best = clearance
  }
  return best === null ? null : round1(best)
}

// ── the verdict ─────────────────────────────────────────────────────────────

/**
 * What the frame's lead media leaves uncovered, in px per axis. `null` when
 * the lead is not a photograph whose paint can be computed (a reel, a map).
 */
export function frameUncovered(frame) {
  if (!frame?.box || frame.lead?.kind !== 'image') return null
  const painted = paintedImageRect(frame.lead.box, frame.lead.natural, frame.lead.fit, frame.lead.position)
  if (!painted) return null
  const inFrame = intersectRect(painted, frame.box)
  if (!inFrame) return { vertical: round1(frame.box.h), horizontal: round1(frame.box.w) }
  return {
    vertical: round1(frame.box.h - inFrame.h),
    horizontal: round1(frame.box.w - inFrame.w),
  }
}

/** Every rect that counts as drawn content: page rects plus painted photographs. */
export function contentRects(m) {
  const out = [...(m.content ?? [])]
  for (const img of m.images ?? []) {
    const painted = paintedImageRect(img.box, img.natural, img.fit, img.position)
    const shown = painted && img.clip ? intersectRect(painted, img.clip) : painted
    if (shown) out.push({ ...shown, kind: 'img' })
  }
  return out
}

/**
 * Derived figures for one listing at one viewport: what the table prints and
 * what the verdict judges. Pure over the page's measurement `m`.
 */
export function summarizeFold(m, limits = FOLD_LIMITS) {
  const vp = m.viewport
  const band = { x: 0, y: 0, w: vp.width, h: vp.height }
  const frame = m.frame ?? null
  const isVideo = frame?.leadKind === 'video'
  const rects = contentRects(m)
  // The hero block: the top of the screen down to the lowest of the three
  // figures the fold must carry. What #386 tightened lives here.
  const keyBottom = Math.max(
    ...[m.address?.box, m.price?.box, m.facts?.box].filter(Boolean).map((b) => b.y + b.h),
  )
  const keyBand = Number.isFinite(keyBottom) && keyBottom > 0
    ? { x: 0, y: 0, w: vp.width, h: Math.min(keyBottom, vp.height) }
    : null
  return {
    address: m.address?.box ?? null,
    price: m.price?.box ?? null,
    facts: m.facts?.box ?? null,
    addressOut: outsideFold(m.address?.box, vp),
    priceOut: outsideFold(m.price?.box, vp),
    factsOut: outsideFold(m.facts?.box, vp),
    frame: frame?.box ?? null,
    frameLead: frame?.leadKind ?? 'none',
    frameRatio: frame?.box && frame.box.w > 0 ? frame.box.h / frame.box.w : null,
    frameMaxH: frame?.box
      ? frame.box.w * (isVideo ? limits.videoFrameMaxHeightPerWidth : limits.photoFrameMaxHeightPerWidth)
      : null,
    uncovered: frameUncovered(frame),
    gap: largestVerticalGap(rects, band),
    keyGap: keyBand ? largestVerticalGap(rects, keyBand) : null,
    jaxPrice: m.jax?.box ? discClearance(m.jax.box, m.price?.text ?? []) : null,
    jaxAddress: m.jax?.box ? discClearance(m.jax.box, m.address?.text ?? []) : null,
  }
}

const fmtBox = (b) => (b ? `${round1(b.y)}..${round1(b.y + b.h)}` : 'absent')

/**
 * The problems for one listing at one viewport. Each names the listing, the
 * viewport, the element, the measured value and its limit.
 */
export function foldProblems(m, limits = FOLD_LIMITS) {
  const s = summarizeFold(m, limits)
  const where = `${m.listing?.label ?? 'listing'} (${m.listing?.path ?? '?'}) @${m.viewport.name}`
  const problems = []
  const push = (element, measured, limit, why) =>
    problems.push({ where, element, measured, limit, message: `${where}: ${element} ${measured} ${limit}. ${why}` })

  const fold = m.viewport.height
  for (const [key, element, what] of [
    ['address', 'address h1.listing-ask', 'the street address'],
    ['price', 'price .listing-ask__price', 'the headline price'],
    ['facts', 'facts .listing-face__facts', 'beds / baths / sq ft'],
  ]) {
    const out = s[`${key}Out`]
    const box = s[key]
    if (!box) {
      push(element, 'is absent', 'from the page', `The first screen must carry ${what}; the page rendered without it.`)
    } else if (out.px > 0) {
      const measured =
        out.edge === 'bottom'
          ? `bottom ${round1(box.y + box.h)}px`
          : out.edge === 'top'
            ? `top ${round1(box.y)}px`
            : out.edge === 'right'
              ? `right ${round1(box.x + box.w)}px`
              : `left ${round1(box.x)}px`
      const limit =
        out.edge === 'bottom' ? `> fold ${fold}px` : out.edge === 'right' ? `> viewport width ${m.viewport.width}px` : '< 0px'
      push(element, measured, limit, `${what[0].toUpperCase()}${what.slice(1)} must sit whole inside the first screen (#386).`)
    }
  }

  if (s.frame && s.frameMaxH != null && s.frame.h > s.frameMaxH + limits.frameTolerancePx) {
    const shape = s.frameLead === 'video' ? '16:9 (a reel leads)' : '4:3, the tallest phone frame (listingFrameAspect)'
    push(
      'hero frame .listing-frame__media',
      `height ${round1(s.frame.h)}px`,
      `> ${round1(s.frameMaxH)}px (${shape}, at width ${round1(s.frame.w)}px)`,
      'The phone frame is the photograph\'s shape, not a fixed-height box (#386).',
    )
  }

  if (s.uncovered) {
    const worst = Math.max(s.uncovered.vertical, s.uncovered.horizontal)
    if (worst > limits.maxUncoveredFramePx) {
      const axis = s.uncovered.vertical >= s.uncovered.horizontal ? 'vertical' : 'horizontal'
      push(
        'hero photo in .listing-frame__media',
        `leaves ${worst}px of the frame empty (${axis})`,
        `> ${limits.maxUncoveredFramePx}px`,
        'The lead photograph covers its phone frame; a contained still in a taller box is the navy letterbox #386 removed.',
      )
    }
  }

  if (s.keyGap && s.keyGap.px > limits.maxHeroBandPx) {
    push(
      'dead space in the hero block (top of screen to the facts line)',
      `${s.keyGap.px}px empty band at y ${s.keyGap.from}..${s.keyGap.to}`,
      `> ${limits.maxHeroBandPx}px`,
      'Nothing is drawn in that band between the chrome and beds / baths / sq ft (no text, photograph, icon or control).',
    )
  }
  if (s.gap.px > limits.maxDeadBandPx) {
    push(
      'dead space in the fold',
      `${s.gap.px}px empty band at y ${s.gap.from}..${s.gap.to}`,
      `> ${limits.maxDeadBandPx}px`,
      'Nothing is drawn in that band of the first screen (no text, photograph, icon or control).',
    )
  }

  for (const [clear, element, what] of [
    [s.jaxPrice, 'Jax .v3-dog-floater over the price', 'price'],
    [s.jaxAddress, 'Jax .v3-dog-floater over the address', 'address'],
  ]) {
    if (clear != null && clear < limits.minJaxClearancePx) {
      push(
        element,
        `overlaps the ${what} text by ${round1(-clear)}px`,
        `(clearance must be >= ${limits.minJaxClearancePx}px)`,
        `Jax is fixed at the right edge half the viewport down; the ${what} may not sit under him.`,
      )
    }
  }

  return problems
}

// ── the table ───────────────────────────────────────────────────────────────

export const TABLE_COLUMNS = Object.freeze([
  ['case', 12],
  ['listing', 24],
  ['viewport', 9],
  ['address y', 13],
  ['price y', 13],
  ['facts y', 13],
  ['frame WxH', 16],
  ['uncovered', 10],
  ['hero band', 22],
  ['fold band', 22],
  ['Jax/price', 10],
  ['Jax/address', 11],
])

/** One printed row per listing x viewport. */
export function tableRow(m) {
  const s = summarizeFold(m)
  const frame = s.frame
    ? `${round1(s.frame.w)}x${round1(s.frame.h)} ${s.frameLead === 'video' ? 'reel' : s.frameLead}`
    : 'absent'
  const uncovered = s.uncovered ? `${Math.max(s.uncovered.vertical, s.uncovered.horizontal)}px` : 'n/a'
  const signed = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : ''}${v}px`)
  const label = String(m.listing?.label ?? '')
  const cells = [
    m.listing?.kind ?? '',
    label.length > 24 ? `${label.slice(0, 22)}..` : label,
    m.viewport.name,
    fmtBox(s.address),
    fmtBox(s.price),
    fmtBox(s.facts),
    frame,
    uncovered,
    s.keyGap ? `${s.keyGap.px}px @${s.keyGap.from}..${s.keyGap.to}` : 'n/a',
    `${s.gap.px}px @${s.gap.from}..${s.gap.to}`,
    signed(s.jaxPrice),
    signed(s.jaxAddress),
  ]
  return cells.map((c, i) => String(c).padEnd(TABLE_COLUMNS[i][1])).join(' ').trimEnd()
}

export function tableHeader() {
  return TABLE_COLUMNS.map(([name, width]) => name.padEnd(width)).join(' ').trimEnd()
}

// ── discovery ───────────────────────────────────────────────────────────────

/**
 * Canonical listing detail paths from /sitemaps/listings.xml, in sitemap
 * order. A canonical path ends in -<MLS number> (lib/slug.ts
 * listingTileHref); the host in <loc> is the production origin, so only the
 * path is kept and the gate aims it at the server under test.
 */
export function listingPathsFromSitemap(xml) {
  const out = []
  const seen = new Set()
  const re = /<loc>([^<]+)<\/loc>/g
  let m
  while ((m = re.exec(String(xml ?? '')))) {
    let path
    try {
      path = new URL(m[1].trim()).pathname
    } catch {
      path = m[1].trim()
    }
    if (!/^\/homes-for-sale\/.+-\d{5,}$/.test(path) || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/** The street part of a canonical slug: "61281-mcroberts-220218727" -> "61281-mcroberts". */
export function streetSlug(path) {
  const last = String(path ?? '').split('/').filter(Boolean).at(-1) ?? ''
  return last.replace(/-\d{5,}$/, '')
}

/** Paths ordered longest street slug first; ties keep sitemap order. */
export function byLongestStreet(paths) {
  return paths
    .map((p, i) => ({ p, i, n: streetSlug(p).length }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.p)
}

/**
 * What the server-rendered HTML of a listing page says about its fold, read
 * without a browser: enough to choose the cases. `data-lead="video"` is the
 * frame's own marker (ListingHero.tsx), `listing-face__drop` the price-cut
 * line, `listing-mosaic__slide--empty` the no-photo frame.
 */
export function classifyListingHtml(html) {
  const text = String(html ?? '')
  const h1 = /<h1[^>]*class="[^"]*\blisting-ask\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(text)
  const address = h1
    ? h1[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
    : null
  const factsMatch = /<div class="listing-face__facts">([\s\S]*?)<\/div>/.exec(text)
  const facts = factsMatch ? factsMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null
  return {
    resolves: address != null,
    address,
    facts,
    // A home: the facts line carries beds and living area ("3 bd · 2 ba ·
    // 1,850 sqft"), the three figures the fold must show. A lot reads "5 acres".
    home: facts != null && /\bbd\b/.test(facts) && /\bsqft\b/.test(facts),
    video: /class="listing-frame__media"[^>]*data-lead="video"|data-lead="video"[^>]*class="listing-frame__media"/.test(text),
    cut: /class="listing-face__drop"/.test(text),
    photos: /class="listing-frame__media"/.test(text) && !/listing-mosaic__slide--empty/.test(text),
  }
}

/**
 * `count` paths spread evenly across the list, first included. The sitemap
 * runs in blocks (a plat's forty lots in a row), so probing its head would
 * see one subdivision; an even spread sees the market.
 */
export function spreadOrder(paths, count) {
  const n = paths.length
  if (n <= count) return [...paths]
  const out = []
  const seen = new Set()
  for (let k = 0; k < count; k += 1) {
    const i = Math.floor((k * n) / count)
    if (!seen.has(i)) {
      seen.add(i)
      out.push(paths[i])
    }
  }
  return out
}

/**
 * The cases the gate measures, chosen from classified candidates. Each is a
 * different listing. `candidates` is [{ path, info }] in probe order; `long`
 * is the same shape, longest street first.
 */
export function chooseCases({ candidates, long }) {
  const used = new Set()
  const usable = (c) => c?.info?.resolves && c.info.home && c.info.photos && !used.has(c.path)
  const take = (kind, list, pred) => {
    const hit = (list ?? []).find((c) => usable(c) && pred(c.info))
    if (!hit) return { kind, missing: true }
    used.add(hit.path)
    return { kind, path: hit.path, address: hit.info.address, info: hit.info }
  }
  // Long address first, so a long address that also leads with a reel is not
  // spent on the video case while a shorter one would have done.
  const longCase = take('long-address', long, () => true)
  const video = take('video', candidates, (i) => i.video)
  const photo = take('photo', candidates, (i) => !i.video && !i.cut)
  const cut = take('price-cut', candidates, (i) => i.cut && !i.video)
  return [video, photo, longCase, cut]
}
