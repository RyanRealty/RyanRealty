/**
 * Scalar coercion subsystem for the listing mapper (pure extraction from
 * lib/listing-mapper.ts, file-size budget split — same pattern as
 * lib/listing-customfields.ts). Every symbol is re-exported from
 * lib/listing-mapper.ts so existing importers keep working.
 *
 * These are the functions that decide what a Spark payload value becomes in a
 * typed column. They are the ONE place a mask, a stringified object, or any
 * other serialization artifact is supposed to die.
 */

/** Numeric coercion. Returns null for masked "****", empty strings, NaN. */
export function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (typeof v === 'string') {
    if (v === '' || /^\*+$/.test(v)) return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

/** Integer coercion for counters (DOM, rooms, etc.). */
export function toInt(v: unknown): number | null {
  const n = toNum(v)
  if (n == null) return null
  const r = Math.round(n)
  return Number.isFinite(r) ? r : null
}

/** Timestamp string validation. Returns null for masked or invalid dates. */
export function toTimestamp(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  if (/^\*+$/.test(v) || v.trim() === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : v
}

/** Date-only string (YYYY-MM-DD). Returns null for masked or invalid. */
export function toDate(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  if (/^\*+$/.test(v) || v.trim() === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Boolean coercion. Handles true/false strings and "Yes"/"No". */
export function toBool(v: unknown): boolean | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const lower = v.toLowerCase().trim()
    if (lower === 'true' || lower === 'yes' || lower === '1') return true
    if (lower === 'false' || lower === 'no' || lower === '0') return false
    if (/^\*+$/.test(v)) return null
  }
  return null
}

/**
 * THE single normalization point for every scalar text column promoted out of
 * the Spark payload (levels, architectural_style, foundation_details, sewer,
 * water, roof, construction_materials, lot_features, fencing, …). Whatever
 * shape the feed hands us, exactly one representation reaches the typed column:
 * a plain comma-joined label string, or null.
 *
 * Shapes handled (all six measured live in `listings.levels`, 2026-07-31):
 *   'One'                      → 'One'          scalar passes through
 *   {One: true}                → 'One'          Spark multi-select object
 *   {One: true, Two: true}     → 'One, Two'     truthy keys, feed order kept
 *   '{"One": true}'            → 'One'          the object after a jsonb→text cast
 *   '[object Object]'          → null           JS object coerced to string
 *   '********'                 → null           Spark mask for an unlicensed field
 *   'One, Two'                 → 'One, Two'     already-normalized comma list
 *
 * WHY EACH GUARD EXISTS (root cause, 2026-07-31): the April promotion of the
 * tier-2 columns out of `details` wrote `levels` with a raw jsonb→text cast and
 * a JS String() coercion instead of reducing the object to its truthy keys.
 * 881 on-market rows froze with '{"One": true}' / '[object Object]' /
 * '********' and were invisible to the singleLevel + levelsOptions filters,
 * which compare the column to the bare label and were exactly right. A value
 * that cannot be reduced to labels carries no information — it must become
 * null, never a raw brace string that a filter can never match and a renderer
 * would leak. Ordering is the feed's, NOT sorted: the 6,393 already-correct
 * rows carry MLS order ('Two, Three Or More'), and sorting here would mint
 * facet values that disagree with them.
 *
 * Mirrors formatMlsMultiSelect (lib/data/listings/mls-multiselect.ts), which
 * defends the same class at READ time for the detail page. This one is the
 * write-side twin: normalize once, at ingest, so nothing downstream has to.
 */
export function toText(v: unknown): string | null {
  if (v == null) return null

  /** Truthy labels of a Spark multi-select object, in feed order. */
  const truthyLabels = (o: Record<string, unknown>): string | null => {
    const keys = Object.keys(o).filter((k) => o[k] === true || o[k] === 'true')
    return keys.length > 0 ? keys.join(', ') : null
  }
  /** Spark masks an unlicensed field with a run of asterisks. Zero information. */
  const isMaskedText = (s: string): boolean => /^\*+$/.test(s.trim()) && s.trim() !== ''

  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '' || isMaskedText(t)) return null
    // A JS object that reached a string sink. Never renderable, never matchable.
    if (t === '[object Object]') return null
    // Object/array-shaped text: the value survived a jsonb→text or JSON.stringify
    // cast somewhere upstream. Reduce it to labels, or drop it — returning the
    // raw braces would put unmatchable JSON into a typed column.
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown
        if (Array.isArray(parsed)) {
          const labels = parsed.filter(
            (x): x is string => typeof x === 'string' && x.trim() !== '' && !isMaskedText(x),
          )
          return labels.length > 0 ? labels.join(', ') : null
        }
        if (parsed !== null && typeof parsed === 'object') {
          return truthyLabels(parsed as Record<string, unknown>)
        }
        return null
      } catch {
        return null // unparseable object/array shape: drop, never leak raw
      }
    }
    return t
  }

  // Arrays from Spark (e.g. ["Frame", "Stone"]) — masked elements do not survive.
  if (Array.isArray(v)) {
    const labels = v
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '' && !isMaskedText(x))
      .map((x) => x.trim())
    return labels.length > 0 ? labels.join(', ') : null
  }

  // Spark multi-select objects like {Frame: true, Concrete: true}
  if (typeof v === 'object') return truthyLabels(v as Record<string, unknown>)

  return null
}
