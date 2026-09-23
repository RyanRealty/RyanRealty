/**
 * Weigh the Atlas's server-rendered props inside a served Next.js page
 * (UXLIVE-3, visibility audit 2026-09-22). Used by
 * scripts/check-atlas-props-budget.mjs and its test.
 *
 * A page's RSC payload rides in `self.__next_f.push([1,"…"])` scripts. The
 * concatenated strings are the flight rows: `<hexid>:<json>\n`, plus
 * length-prefixed text rows `<hexid>:T<hexbytes>,<text>`. Every row is parsed;
 * any object shaped like V3Atlas props (a `regions` array, a `types` array and
 * a `headline`) is an Atlas, and its JSON size, with `$<id>` row references
 * resolved and `children` left out, is its weight.
 */

/** The decoded flight text of a served HTML document. */
export function flightText(html) {
  let out = ''
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  for (const m of html.matchAll(re)) {
    try {
      out += JSON.parse(m[1])
    } catch {
      // A chunk that is not a plain string push is not flight data.
    }
  }
  return out
}

/** Flight rows by id: parsed JSON where the row is JSON, else the raw text. */
export function flightRows(text) {
  const buf = Buffer.from(text, 'utf8')
  const rows = new Map()
  let pos = 0
  const idRe = /^([0-9a-f]+):/
  while (pos < buf.length) {
    // Skip stray newlines between rows.
    while (pos < buf.length && buf[pos] === 0x0a) pos += 1
    if (pos >= buf.length) break
    const head = buf.subarray(pos, Math.min(buf.length, pos + 24)).toString('utf8')
    const m = head.match(idRe)
    if (!m) {
      // Unknown framing: resynchronise at the next newline.
      const nl = buf.indexOf(0x0a, pos)
      pos = nl < 0 ? buf.length : nl + 1
      continue
    }
    const id = m[1]
    pos += Buffer.byteLength(m[0])
    if (buf[pos] === 0x54 /* T */) {
      const comma = buf.indexOf(0x2c, pos)
      const len = parseInt(buf.subarray(pos + 1, comma).toString('utf8'), 16)
      rows.set(id, buf.subarray(comma + 1, comma + 1 + len).toString('utf8'))
      pos = comma + 1 + len
      continue
    }
    const nl = buf.indexOf(0x0a, pos)
    const end = nl < 0 ? buf.length : nl
    const raw = buf.subarray(pos, end).toString('utf8')
    pos = end + 1
    try {
      rows.set(id, JSON.parse(raw))
    } catch {
      rows.set(id, raw)
    }
  }
  return rows
}

const REF = /^\$([0-9a-f]+)$/

/** A value with `"$<id>"` model references replaced by the rows they name. */
export function resolveRefs(value, rows, seen = new Set()) {
  if (typeof value === 'string') {
    const m = value.match(REF)
    if (m && rows.has(m[1]) && !seen.has(m[1])) {
      const next = new Set(seen)
      next.add(m[1])
      return resolveRefs(rows.get(m[1]), rows, next)
    }
    return value
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, rows, seen))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveRefs(v, rows, seen)
    return out
  }
  return value
}

function isAtlasProps(obj, rows) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  if (!('regions' in obj) || !('types' in obj) || !('headline' in obj)) return false
  const regions = resolveRefs(obj.regions, rows)
  const types = resolveRefs(obj.types, rows)
  return Array.isArray(regions) && Array.isArray(types)
}

/** The keys an Atlas's weight is reported by, heaviest first in practice. */
export const ATLAS_PROP_KEYS = [
  'dots',
  'dotsSummary',
  'regions',
  'childRegions',
  'amenities',
  'basemap',
  'parcels',
  'frame',
  'events',
  'types',
]

/**
 * Every Atlas in a served page: its id and the bytes of its props (resolved,
 * `children` excluded), with a per-key breakdown, and whether the page marked
 * its read incomplete.
 */
export function weighAtlasProps(html) {
  const rows = flightRows(flightText(html))
  const found = []
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n)
      return
    }
    if (!node || typeof node !== 'object') return
    if (isAtlasProps(node, rows)) {
      const props = Object.fromEntries(Object.entries(node).filter(([k]) => k !== 'children'))
      const resolved = resolveRefs(props, rows)
      const byKey = {}
      for (const key of ATLAS_PROP_KEYS) {
        if (resolved[key] !== undefined) byKey[key] = Buffer.byteLength(JSON.stringify(resolved[key]))
      }
      found.push({
        id: typeof resolved.id === 'string' ? resolved.id : '?',
        bytes: Buffer.byteLength(JSON.stringify(resolved)),
        byKey,
        // The page's read came back short: deferredAtlasProps then keeps the
        // dots inline on purpose (the route could not rebuild that population).
        incomplete: resolved.incomplete === true,
      })
      return
    }
    for (const v of Object.values(node)) visit(v)
  }
  for (const row of rows.values()) visit(row)
  return found
}
