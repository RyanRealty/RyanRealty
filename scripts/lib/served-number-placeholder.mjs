/**
 * served-number-placeholder.mjs — finds count-up numerals whose SERVED face is
 * the wheel's start instead of the settled figure.
 *
 * WHY. `components/motion/number.tsx` (beui-number, wrapped by V3Number) once
 * seeded its display state with 0, so every server-rendered page carried
 * `<span class="… v3-number …">0</span>` and only hydration swapped in the real
 * count. On /cities that read "0 houses came on the market in Central Oregon in
 * the last 30 days" beside a source line naming 256 (SITE-117, 2026-09-16) —
 * on every alerts strip, MOS bar, Instrument face and ZIP claim the site
 * serves. A crawler, a no-JS reader and anyone on a slow connection read a
 * false zero (CLAUDE.md §0).
 *
 * THE MECHANISM. The primitive now writes its settled figure into
 * `data-settled` beside the face. A served span whose face is exactly "0" while
 * its data-settled is a non-zero number is the placeholder coming back, whatever
 * the caller, whatever the page. A settled 0 with a face of 0 is an honest zero
 * and passes. ci:route-smoke runs this over every canonical route's body.
 *
 * Pure: a string in, a list of hits out. No fetch, no DOM.
 */

const SETTLED_SPAN = /<span\b([^>]*\bdata-settled="([^"]*)"[^>]*)>([^<]*)<\/span>/g

/**
 * @param {string} body served HTML
 * @returns {Array<{settled: number, face: string, tag: string}>} one entry per
 *   numeral whose face is "0" under a non-zero settled figure
 */
export function findPlaceholderZeros(body) {
  const hits = []
  if (typeof body !== 'string' || body.length === 0) return hits
  for (const m of body.matchAll(SETTLED_SPAN)) {
    const settled = Number(m[2])
    const face = m[3].trim()
    if (!Number.isFinite(settled) || settled === 0) continue
    if (face === '0') hits.push({ settled, face, tag: m[0].slice(0, 200) })
  }
  return hits
}

/** One reason line for a gate report, or null when the body is clean. */
export function placeholderZeroReason(body) {
  const hits = findPlaceholderZeros(body)
  if (hits.length === 0) return null
  const figures = hits.map((h) => h.settled.toLocaleString('en-US')).join(', ')
  return (
    `${hits.length} count-up numeral${hits.length === 1 ? '' : 's'} served as "0" under a non-zero ` +
    `settled figure (${figures}) — the AnimatedNumber placeholder is back (SITE-117)`
  )
}
