/**
 * content-floor.mjs — the no-regression contract behind ci:route-content-floor.
 *
 * Matt 2026-09-12 ("fix it all"): the gate he actually cares about is the one
 * the loop never had. Rounds one to three "improved" pages by the taste score
 * while the About fold lost its full-width hero, the office photo dropped to a
 * thumbnail, and a listing page shed its video — every one of those was a
 * score rise. The evaluator grades pixels in a fold; it cannot see that the
 * page used to carry more.
 *
 * So every public class carries a `contentFloor` on its parity.json: the
 * measured shape of the page as served on the day the floor was seeded, with
 * a tolerance. A build that comes in under the floor fails BEFORE the
 * evaluator is ever asked. Lowering a floor is allowed only by editing the
 * number in the same commit — visible in the diff, never implicit.
 *
 * What is measured (one page, 1440 wide, scrolled to the bottom so lazy media
 * loads):
 *   h1            — count of <h1> in <main> (or body when no main)
 *   words         — visible words in <main>
 *   headings      — <h2> count
 *   sections      — <section> count
 *   internalLinks — same-origin <a href> count
 *   images        — <img> with naturalWidth >= 800 that finished loading
 *   heroImageWidth — rendered CSS width of the widest <img> whose top is in
 *                    the first 1200px; 0 when there is none
 *   heroImageNatural — that image's naturalWidth (its resolution)
 *   video         — <video> plus embedded players (youtube / vimeo / mux)
 *   jsonLd        — <script type="application/ld+json"> count
 *
 * Floors are ratios of the seeded reading (see TOLERANCE), except the exact
 * ones: h1 is exact, jsonLd and video may not drop below the seed.
 */

export const METRICS = Object.freeze([
  'h1',
  'words',
  'headings',
  'sections',
  'internalLinks',
  'images',
  'heroImageWidth',
  'heroImageNatural',
  'video',
  'jsonLd',
])

/** Fraction of the seeded value a page must keep. 1 = exact/at-least. */
export const TOLERANCE = Object.freeze({
  h1: 1,
  words: 0.7,
  headings: 0.7,
  sections: 0.8,
  internalLinks: 0.7,
  images: 0.7,
  heroImageWidth: 0.9,
  heroImageNatural: 0.9,
  video: 1,
  jsonLd: 1,
})

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Turn one measurement into a floor. Dynamic pages (a listing that may go
 * off-market, a city whose inventory moves) still get a floor — the ratio is
 * the slack, and a class that truly varies more than that names it in
 * `contentFloor.note` and lowers the number by hand.
 */
export function seedFloor(measured, { seededAt, seededFrom, viewport = 1440 } = {}) {
  if (!isPlainObject(measured)) throw new Error('seedFloor: measured must be an object')
  const floors = {}
  for (const m of METRICS) {
    const v = Number(measured[m])
    if (!Number.isFinite(v)) continue
    if (m === 'h1') {
      floors.h1 = v
      continue
    }
    floors[m] = Math.floor(v * TOLERANCE[m])
  }
  return {
    seededAt: seededAt ?? new Date().toISOString().slice(0, 10),
    seededFrom: seededFrom ?? 'unknown',
    viewport,
    observed: Object.fromEntries(METRICS.filter((m) => Number.isFinite(Number(measured[m]))).map((m) => [m, Number(measured[m])])),
    floors,
  }
}

/**
 * Find the [start, end) span of the top-level `"contentFloor": {...}` member
 * in a JSON text, including a leading comma when the member is not first.
 * Returns null when the key is absent. String-aware so a brace inside a note
 * does not confuse the walk.
 */
function contentFloorSpan(text) {
  const keyRe = /"contentFloor"\s*:\s*\{/g
  let m
  while ((m = keyRe.exec(text))) {
    // Only a top-level member: walk back to the previous non-space char and make
    // sure we are at depth 1 by counting from the start.
    let depth = 0
    let inStr = false
    for (let i = 0; i < m.index; i += 1) {
      const ch = text[i]
      if (inStr) {
        if (ch === '\\') i += 1
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{' || ch === '[') depth += 1
      else if (ch === '}' || ch === ']') depth -= 1
    }
    if (depth !== 1) continue
    // Walk forward from the opening brace to its match.
    let j = m.index + m[0].length
    depth = 1
    inStr = false
    for (; j < text.length && depth > 0; j += 1) {
      const ch = text[j]
      if (inStr) {
        if (ch === '\\') j += 1
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
    }
    let start = m.index
    // Swallow the separating comma + whitespace before the key when present.
    let k = start - 1
    while (k >= 0 && /\s/.test(text[k])) k -= 1
    const hadLeadingComma = text[k] === ','
    if (hadLeadingComma) start = k
    // Or the comma after the member when it was the first key.
    let end = j
    if (!hadLeadingComma) {
      let q = end
      while (q < text.length && /\s/.test(text[q])) q += 1
      if (text[q] === ',') end = q + 1
    }
    return { start, end, hadLeadingComma }
  }
  return null
}

/**
 * Write `contentFloor` into a parity.json TEXT without reformatting the rest
 * of the file. The builders hand-edit these files (inline beats, adaptedFrom
 * one-liners); a JSON.stringify round-trip turned a ten-line change into a
 * thousand-line diff. Replaces the existing member in place, or appends one
 * as the last top-level member.
 */
export function spliceContentFloor(text, floor) {
  if (typeof text !== 'string' || !text.trim().startsWith('{')) throw new Error('spliceContentFloor: text must be a JSON object document')
  JSON.parse(text) // must already be valid
  const block = JSON.stringify(floor, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n')
  const member = `"contentFloor": ${block}`
  const span = contentFloorSpan(text)
  if (span) {
    const lead = span.hadLeadingComma ? ',\n  ' : ''
    const tail = span.hadLeadingComma ? '' : ',\n  '
    const out = `${text.slice(0, span.start)}${lead}${member}${tail}${text.slice(span.end)}`
    JSON.parse(out)
    return out
  }
  const close = text.lastIndexOf('}')
  if (close < 0) throw new Error('spliceContentFloor: no closing brace')
  let k = close - 1
  while (k >= 0 && /\s/.test(text[k])) k -= 1
  const empty = text[k] === '{'
  const out = `${text.slice(0, k + 1)}${empty ? '' : ','}\n  ${member}\n}\n`
  JSON.parse(out)
  return out
}

/** Shape problems on a parity.json contentFloor. */
export function floorShapeProblems(floor) {
  if (!isPlainObject(floor)) return ['contentFloor must be an object.']
  const p = []
  if (!isPlainObject(floor.floors)) p.push('contentFloor.floors must be an object of metric -> minimum.')
  else {
    for (const [k, v] of Object.entries(floor.floors)) {
      if (!METRICS.includes(k)) p.push(`contentFloor.floors.${k} is not a known metric (${METRICS.join(', ')}).`)
      else if (!Number.isInteger(v) || v < 0) p.push(`contentFloor.floors.${k} must be a non-negative integer.`)
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(floor.seededAt ?? ''))) p.push('contentFloor.seededAt must be YYYY-MM-DD.')
  if (typeof floor.seededFrom !== 'string' || !floor.seededFrom.trim()) p.push('contentFloor.seededFrom must name the base URL the floor was read from.')
  return p
}

/**
 * Compare a fresh measurement with a floor. h1 is exact; everything else is
 * at-least. Returns problems as strings; empty = the page holds its floor.
 */
export function floorProblems(measured, floor) {
  const shape = floorShapeProblems(floor)
  if (shape.length) return shape
  if (!isPlainObject(measured)) return ['no measurement — the page did not render.']
  const p = []
  for (const [metric, min] of Object.entries(floor.floors)) {
    const got = Number(measured[metric])
    if (!Number.isFinite(got)) {
      p.push(`${metric}: not measured (floor ${min}).`)
      continue
    }
    if (metric === 'h1') {
      if (got !== min) p.push(`h1: ${got}, the floor is exactly ${min}.`)
      continue
    }
    if (got < min) {
      const was = isPlainObject(floor.observed) && Number.isFinite(Number(floor.observed[metric])) ? ` (was ${floor.observed[metric]} on ${floor.seededAt})` : ''
      p.push(`${metric}: ${got} < floor ${min}${was}.`)
    }
  }
  return p
}

/**
 * The in-page measurement. Serialised into the page with Function.toString,
 * so it must be self-contained: no imports, no closures over module state.
 */
export function measurePage() {
  const root = document.querySelector('main') || document.body
  const words = (root.innerText || '').split(/\s+/).filter(Boolean).length
  const imgs = Array.from(document.images)
  const loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0)
  const bigImages = loaded.filter((i) => i.naturalWidth >= 800).length
  let heroImageWidth = 0
  let heroImageNatural = 0
  for (const i of loaded) {
    const r = i.getBoundingClientRect()
    const top = r.top + window.scrollY
    if (top < 1200 && r.width > heroImageWidth) {
      heroImageWidth = Math.round(r.width)
      heroImageNatural = i.naturalWidth
    }
  }
  const origin = location.origin
  const internalLinks = Array.from(document.querySelectorAll('a[href]')).filter((a) => {
    try {
      return new URL(a.getAttribute('href'), origin).origin === origin
    } catch {
      return false
    }
  }).length
  const video =
    document.querySelectorAll('video').length +
    Array.from(document.querySelectorAll('iframe[src]')).filter((f) => /youtube|youtu\.be|vimeo|mux\.com|player\./i.test(f.src)).length
  return {
    h1: root.querySelectorAll('h1').length,
    words,
    headings: root.querySelectorAll('h2').length,
    sections: root.querySelectorAll('section').length,
    internalLinks,
    images: bigImages,
    heroImageWidth,
    heroImageNatural,
    video,
    jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
  }
}
