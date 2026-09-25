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
 *
 * SECTION DEPTH (Matt 2026-09-16, "my community pages are also being
 * stripped"): three main-branch commits on 2026-09-15 cut taxlot parcels off
 * the Atlas, trimmed a plat index's provenance, and genericized copy — while
 * every section id stayed on the page. The ten metrics above never noticed:
 * `sections` above only COUNTS `<section>` elements, and `words`/`images`/etc.
 * are PAGE totals. A section can shed 80% of its rows and none of the ten
 * totals move enough to trip a floor. `measurePage()` now also returns
 * `sectionDepth`: for every top-level id'd block under <main>,
 * `{ [id]: { items, words } }` — the SHAPE of that one section, not the page.
 *
 * `sectionDepth` is a DELIBERATELY DIFFERENT KEY from `sections` above, even
 * though the originating request named both "sections": `sections` is a
 * number (the `<section>` count) and every already-seeded parity.json already
 * carries a numeric `floors.sections` — reusing that key for an id-keyed
 * object would make `floorShapeProblems` reject every existing seed's
 * `floors.sections: 11` as "not an object of id -> {items, words}" the moment
 * this shipped. `sectionDepth` rides beside `sections`, never displaces it.
 *
 * See `measurePage()` for the element-selection rule and the item-count
 * rule, and `seedSectionFloors()` for how a floor is derived from a reading.
 * Backward compatible: a `contentFloor` with no `floors.sectionDepth` key is
 * not depth-checked at all — every floor seeded before this shipped has no
 * such key, and holds its floor exactly as it did before this existed.
 *
 * SITE-119 (Matt 2026-09-16): item counts skip any candidate that is itself
 * aria-hidden or sits under an aria-hidden ancestor. The Atlas sales-legend
 * renders four empty swatch `<li>`s inside `<ol aria-hidden="true">`; those
 * are color chips, not content. The 2026-09-12 cities/community atlas seeds
 * counted them (observed 9 = 5 real rows + 4 chips; floors.items 8). Do not
 * lower those floors here — Matt approves a re-seed. Proposed, counted-
 * decoration reason only: `sectionDepth.atlas.items` 8 → 4 on cities and
 * community (`Math.floor(5 * 0.9)`). honestyFunction / requiredComponents
 * are untouched.
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

/**
 * Section depth (Matt 2026-09-16). A section only gets a floor when it
 * carries enough to ratchet — a one-line disclosure block seeded at 1 item
 * would fail the moment its wording changed. `items` OR `words` clearing its
 * bar is enough to seed both (a section's floor always carries both keys it
 * measured, so a words-only regression on an item-poor section still shows).
 */
export const SECTION_SEED_MIN_ITEMS = 3
export const SECTION_SEED_MIN_WORDS = 40
/** Same ratchet ratio TOLERANCE.sections already used for the page-level count. */
export const SECTION_TOLERANCE = 0.9
/** The metrics a section's floor may carry. Mirrors the shape of `sectionDepth[id]`. */
export const SECTION_METRICS = Object.freeze(['items', 'words'])

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Turn one page's measured `sectionDepth` map into `{ observed, floors }`.
 * `observed` records every section's raw reading — full transparency for a
 * reviewer even when a section is too small to ratchet. `floors` only gets a
 * key for a section clearing SECTION_SEED_MIN_ITEMS or SECTION_SEED_MIN_WORDS
 * (a trivial block — a one-line disclaimer, an empty-state message — is not
 * worth ratcheting, and a floor on it would nuisance-fail on rewording).
 * Pure and side-effect-free so it is unit-testable without a browser.
 */
export function seedSectionFloors(sectionDepth) {
  const observed = {}
  const floors = {}
  if (!isPlainObject(sectionDepth)) return { observed, floors }
  for (const [id, raw] of Object.entries(sectionDepth)) {
    if (!isPlainObject(raw)) continue
    const items = Number(raw.items)
    const words = Number(raw.words)
    const hasItems = Number.isFinite(items)
    const hasWords = Number.isFinite(words)
    if (!hasItems && !hasWords) continue
    observed[id] = {
      ...(hasItems ? { items } : {}),
      ...(hasWords ? { words } : {}),
    }
    const qualifies = (hasItems && items >= SECTION_SEED_MIN_ITEMS) || (hasWords && words >= SECTION_SEED_MIN_WORDS)
    if (!qualifies) continue
    floors[id] = {
      ...(hasItems ? { items: Math.floor(items * SECTION_TOLERANCE) } : {}),
      ...(hasWords ? { words: Math.floor(words * SECTION_TOLERANCE) } : {}),
    }
  }
  return { observed, floors }
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
  const observed = Object.fromEntries(METRICS.filter((m) => Number.isFinite(Number(measured[m]))).map((m) => [m, Number(measured[m])]))
  // Section depth rides alongside the ten page-level metrics, keyed
  // `sectionDepth` on both `observed` and `floors` — a DIFFERENT key from the
  // page-level `sections` count above (see the file header) — and never
  // present when the page measurement carried no `sectionDepth` map, which
  // keeps a caller that still hands seedFloor a pre-depth measurement
  // byte-identical to before.
  if (isPlainObject(measured.sectionDepth)) {
    const { observed: depthObserved, floors: depthFloors } = seedSectionFloors(measured.sectionDepth)
    if (Object.keys(depthObserved).length) observed.sectionDepth = depthObserved
    if (Object.keys(depthFloors).length) floors.sectionDepth = depthFloors
  }
  return {
    seededAt: seededAt ?? new Date().toISOString().slice(0, 10),
    seededFrom: seededFrom ?? 'unknown',
    viewport,
    observed,
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

/** Shape problems on one section's `{ items, words }` floor entry. */
function sectionFloorShapeProblems(id, sub) {
  const p = []
  if (!isPlainObject(sub)) {
    p.push(`contentFloor.floors.sectionDepth.${id} must be an object of {items, words}.`)
    return p
  }
  for (const [k, v] of Object.entries(sub)) {
    if (!SECTION_METRICS.includes(k)) p.push(`contentFloor.floors.sectionDepth.${id}.${k} is not a known section metric (${SECTION_METRICS.join(', ')}).`)
    else if (!Number.isInteger(v) || v < 0) p.push(`contentFloor.floors.sectionDepth.${id}.${k} must be a non-negative integer.`)
  }
  return p
}

/** Shape problems on a parity.json contentFloor. */
export function floorShapeProblems(floor) {
  if (!isPlainObject(floor)) return ['contentFloor must be an object.']
  const p = []
  if (!isPlainObject(floor.floors)) p.push('contentFloor.floors must be an object of metric -> minimum.')
  else {
    for (const [k, v] of Object.entries(floor.floors)) {
      if (k === 'sectionDepth') {
        // `sectionDepth` is the one member of `floors` that is not a flat
        // metric: it is a map of section id -> {items, words}. Validated
        // separately from METRICS/integer, which every OTHER key in `floors`
        // (including the pre-existing numeric `sections` count) must be.
        if (!isPlainObject(v)) p.push('contentFloor.floors.sectionDepth must be an object of section id -> {items, words}.')
        else for (const [id, sub] of Object.entries(v)) p.push(...sectionFloorShapeProblems(id, sub))
        continue
      }
      if (!METRICS.includes(k)) p.push(`contentFloor.floors.${k} is not a known metric (${METRICS.join(', ')}).`)
      else if (!Number.isInteger(v) || v < 0) p.push(`contentFloor.floors.${k} must be a non-negative integer.`)
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(floor.seededAt ?? ''))) p.push('contentFloor.seededAt must be YYYY-MM-DD.')
  if (typeof floor.seededFrom !== 'string' || !floor.seededFrom.trim()) p.push('contentFloor.seededFrom must name the base URL the floor was read from.')
  // sectionDepthSeededAt is optional (only diverges from seededAt after a
  // --sections-only reseed) but must be a real date when present.
  if (floor.sectionDepthSeededAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(floor.sectionDepthSeededAt))) {
    p.push('contentFloor.sectionDepthSeededAt must be YYYY-MM-DD when present.')
  }
  return p
}

/**
 * Compare a fresh measurement's `sectionDepth` map (id -> {items, words})
 * with a floor's `floors.sectionDepth`. Returns problems as strings; the
 * PRINTED prefix is `sections.<id>.<metric>` (matching the wording of the
 * page-level metric problems above) even though the underlying field is
 * `sectionDepth` — see the file header for why the field itself is not
 * called `sections`. A section id present in the floor but absent from the
 * page is its own problem ("section #<id> gone"), because a page that
 * quietly stopped rendering a section is a worse failure than one that
 * shrank it. Pure and unit-testable without a browser — `measuredSectionDepth`
 * is the plain object `measurePage()` would have returned as `sectionDepth`.
 */
export function sectionFloorProblems(measuredSectionDepth, floor) {
  const sectionFloors = isPlainObject(floor?.floors) ? floor.floors.sectionDepth : null
  if (!isPlainObject(sectionFloors)) return []
  const observedSections = isPlainObject(floor.observed) && isPlainObject(floor.observed.sectionDepth) ? floor.observed.sectionDepth : {}
  const seededAt = typeof floor.sectionDepthSeededAt === 'string' ? floor.sectionDepthSeededAt : floor.seededAt
  const measured = isPlainObject(measuredSectionDepth) ? measuredSectionDepth : {}
  const p = []
  for (const [id, secMin] of Object.entries(sectionFloors)) {
    if (!isPlainObject(secMin)) continue
    const got = measured[id]
    if (!isPlainObject(got)) {
      const hadItems = Number.isFinite(Number(observedSections[id]?.items)) ? observedSections[id].items : secMin.items
      const hadWords = Number.isFinite(Number(observedSections[id]?.words)) ? observedSections[id].words : secMin.words
      const had = Number.isFinite(Number(hadItems)) ? `${hadItems} item${Number(hadItems) === 1 ? '' : 's'}` : `${hadWords} words`
      p.push(`section #${id} gone (had ${had} on ${seededAt}).`)
      continue
    }
    for (const sub of SECTION_METRICS) {
      const min = secMin[sub]
      if (!Number.isFinite(Number(min))) continue
      const gotSub = Number(got[sub])
      if (!Number.isFinite(gotSub)) {
        p.push(`sections.${id}.${sub}: not measured (floor ${min}).`)
        continue
      }
      if (gotSub < min) {
        const obsVal = observedSections[id]?.[sub]
        const was = Number.isFinite(Number(obsVal)) ? ` (was ${obsVal} on ${seededAt})` : ''
        p.push(`sections.${id}.${sub}: ${gotSub} < floor ${min}${was}.`)
      }
    }
  }
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
    if (metric === 'sectionDepth') continue // depth is compared separately below — it is not a flat number
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
  p.push(...sectionFloorProblems(measured.sectionDepth, floor))
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

  // Section depth (Matt 2026-09-16): the SHAPE of each top-level id'd block
  // under <root>, not just the page totals above.
  //
  // Element rule: an id'd element is a "section" boundary when NO element
  // between it and <root> also carries an id. Checked, not assumed, against
  // the live primitives (components/site/v3/*): V3PlaceIndex, V3Ledger,
  // V3Instrument, V3Quiet, V3CourseMap, V3Answers and V3AlertsStrip all put
  // the caller's `id` on a `<section>`, but PlaceSplitView (the #homes
  // block) puts it on a plain `<div>` — so the rule keys on "has an id and
  // nothing id'd is between it and root", not on a tag name, which is the
  // only way to catch both without hand-listing components. That same rule
  // is what excludes an id that is NOT a section boundary: a heading's own
  // `${id}-heading` aria target and an individual row's id (V3Answers'
  // question rows) always sit inside an already-id'd ancestor. Duplicate ids
  // (two branches emitting the same id when only one can ever render) keep
  // the FIRST match in document order.
  //
  // Item rule: count `li, article, tr, [data-floor-item]` inside the
  // section, deduplicated so a nested list does not double-count — only a
  // candidate whose closest matching ancestor WITHIN the section is itself
  // (not another li/article/tr/[data-floor-item]) counts. `data-floor-item`
  // is an escape hatch for a card grid built from neither tag.
  //
  // SITE-119: skip a candidate that is aria-hidden or sits under
  // aria-hidden. Bare `aria-hidden` (no value) is the same as "true";
  // `aria-hidden="false"` is not hidden. A real row whose *child* mark is
  // aria-hidden still counts — the row itself is the content. This is why
  // the Atlas key `<li>` (label + hidden swatch span) counts and the four
  // empty sales-legend swatch `<li>`s inside `<ol aria-hidden="true">` do
  // not. Must stay inline: this function is serialised into the page.
  // A modal manager's hiding is page STATE, not decoration. Radix dialogs,
  // menus and selects hide everything outside themselves through the
  // aria-hidden library, which marks each node it hides with
  // data-aria-hidden. CI on 2026-09-24 read #towns (six real ledger rows,
  // words intact) and #edges at 0 items because both carried that hiding;
  // the page's own aria-hidden (a swatch list, a glyph) never has the marker.
  // Rows under the page's OWN aria-hidden, such as a closed overlay host,
  // still count as zero (Matt 2026-09-24, "Keep counting as zero"): content
  // nobody sees without opening an overlay does not hold the section's floor.
  function isAriaHidden(node) {
    let n = node
    while (n && n.nodeType === 1) {
      const raw = n.getAttribute('aria-hidden')
      if ((raw === 'true' || raw === '') && !n.hasAttribute('data-aria-hidden')) return true
      n = n.parentElement
    }
    return false
  }
  // Why an item count reads low (printed only when a section floor fails):
  // how many candidates the section held, how many were skipped as
  // aria-hidden, and the first element that hid them. A CI read on
  // 2026-09-24 measured #towns at 0 items with its words intact, on a build
  // that renders six rows; this says which of those it was next time.
  function hiddenAncestor(node) {
    let n = node
    while (n && n.nodeType === 1) {
      const raw = n.getAttribute('aria-hidden')
      if (raw === 'true' || raw === '') {
        const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
        return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${cls ? `.${cls}` : ''}`
      }
      n = n.parentElement
    }
    return null
  }
  const sectionDepth = {}
  const sectionDiag = {}
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    const id = el.id
    if (!id || Object.prototype.hasOwnProperty.call(sectionDepth, id)) continue
    let ancestor = el.parentElement
    let nested = false
    while (ancestor && ancestor !== root) {
      if (ancestor.id) {
        nested = true
        break
      }
      ancestor = ancestor.parentElement
    }
    if (nested) continue
    const itemSelector = 'li, article, tr, [data-floor-item]'
    let items = 0
    let candidates = 0
    let hiddenItems = 0
    let hiddenBy = null
    for (const c of Array.from(el.querySelectorAll(itemSelector))) {
      candidates += 1
      if (isAriaHidden(c)) {
        hiddenItems += 1
        if (!hiddenBy) hiddenBy = hiddenAncestor(c)
        continue
      }
      let p = c.parentElement
      let topmost = true
      while (p && p !== el) {
        if (p.matches(itemSelector)) {
          topmost = false
          break
        }
        p = p.parentElement
      }
      if (topmost) items += 1
    }
    const sectionWords = (el.innerText || '').split(/\s+/).filter(Boolean).length
    sectionDepth[id] = { items, words: sectionWords }
    sectionDiag[id] = {
      tag: el.tagName.toLowerCase(),
      candidates,
      hiddenItems,
      hiddenBy,
      overlayHidden: Boolean(el.closest('[data-aria-hidden]')),
    }
  }

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
    sectionDepth,
    sectionDiag,
    // Open overlays at read time (printed only when a section floor fails).
    openDialogs: Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"]'))
      .filter((d) => d.getAttribute('data-state') === 'open' || d.getAttribute('aria-modal') === 'true')
      .map((d) => `${d.tagName.toLowerCase()}.${String(d.className || '').trim().split(/\s+/).slice(0, 3).join('.')}`),
  }
}
