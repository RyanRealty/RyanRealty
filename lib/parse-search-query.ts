/**
 * parse-search-query — the "speak plainly" translation layer.
 *
 * Per MASTER_SPEC §1875 + PRODUCT_SPEC_V2 (natural-language search): a THIN
 * translator that turns a typed-or-spoken plain-language query into the
 * structured query params the existing /homes-for-sale filter system already
 * understands. Not a semantic embedding engine — deterministic, dependency-free,
 * always works.
 *
 *   "3-bedroom with mountain views under $600k in Bend"
 *     -> { beds: '3', hasView: '1', maxPrice: '600000', city: 'Bend' }
 *   "3 bed under $800k in Bend with a shop"
 *     -> { beds: '3', maxPrice: '800000', city: 'Bend', keywords: 'shop' }
 *   "modern farmhouse"                 -> { keywords: 'modern farmhouse' }
 *   "redmond"                          -> { city: 'Redmond' }
 *
 * Returns a flat string map ready for `new URLSearchParams(...)`.
 */

export type ParsedSearch = Record<string, string>

// Central Oregon cities the structured filter understands (by display name).
// Longer/compound names first so "la pine" wins before a bare token match.
const CITY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bla[\s-]?pine\b/i, 'La Pine'],
  [/\bpowell\s?butte\b/i, 'Powell Butte'],
  [/\bblack\s?butte\b/i, 'Sisters'],
  [/\bbend\b/i, 'Bend'],
  [/\bredmond\b/i, 'Redmond'],
  [/\bsisters\b/i, 'Sisters'],
  [/\bsunriver\b/i, 'Sunriver'],
  [/\bterrebonne\b/i, 'Terrebonne'],
  [/\bprineville\b/i, 'Prineville'],
  [/\bmadras\b/i, 'Madras'],
  [/\btumalo\b/i, 'Tumalo'],
  [/\bculver\b/i, 'Culver'],
]

// Feature words that map to a structured filter the search already supports.
const FEATURE_FLAGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(mountain|cascade|territorial)?\s?views?\b/i, 'hasView'],
  [/\bpool\b/i, 'hasPool'],
  [/\b(waterfront|river\s?front|riverfront|lakefront|on the (river|water))\b/i, 'hasWaterfront'],
  [/\bfireplace\b/i, 'hasFireplace'],
  [/\bgolf\b/i, 'hasGolfCourse'],
]

// Free-text feature terms with no structured filter — passed as keywords (the
// search does a remarks/features text match on these, exactly like the presets).
const KEYWORD_TERMS = [
  'shop', 'rv', 'barn', 'adu', 'guest house', 'casita', 'single level', 'single story',
  'one level', 'new construction', 'remodeled', 'acreage', 'horse', 'shouse', 'workshop',
]

function parseMoney(numStr: string, unit?: string): number | null {
  const n0 = parseFloat(numStr.replace(/[,$\s]/g, ''))
  if (!Number.isFinite(n0)) return null
  let n = n0
  const u = (unit || '').toLowerCase()
  if (u === 'k') n *= 1_000
  else if (u === 'm') n *= 1_000_000
  else if (n < 10_000) n *= 1_000 // bare "800" in a price context means $800k
  return Math.round(n)
}

export function parseSearchQuery(raw: string): ParsedSearch {
  const q = (raw || '').trim()
  const out: ParsedSearch = {}
  if (!q) return out
  const lower = q.toLowerCase()

  // `-?` so "3-bedroom" works as well as "3 bed" / "3bd" / "3 br".
  const beds = lower.match(/(\d+)\s*-?\s*\+?\s*(?:bedrooms?|beds?|bd|br)\b/)
  if (beds) out.beds = beds[1]

  const baths = lower.match(/(\d+(?:\.\d)?)\s*-?\s*\+?\s*(?:bathrooms?|baths?|ba)\b/)
  if (baths) out.baths = String(Math.max(1, Math.floor(parseFloat(baths[1]))))

  const max = lower.match(/(?:under|below|less than|up to|max|cheaper than|<)\s*\$?\s*([\d,.]+)\s*([km])?/)
  if (max) {
    const v = parseMoney(max[1], max[2])
    if (v) out.maxPrice = String(v)
  }
  const min = lower.match(/(?:over|above|more than|at least|starting at|from|min|>)\s*\$?\s*([\d,.]+)\s*([km])?/)
  if (min) {
    const v = parseMoney(min[1], min[2])
    if (v) out.minPrice = String(v)
  }

  const garage = lower.match(/(\d+)\s*\+?\s*car\s*garage/)
  if (garage) out.garageMin = garage[1]

  const acres = lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*acres?\b/)
  if (acres) out.lotAcresMin = acres[1]

  for (const [re, name] of CITY_PATTERNS) {
    if (re.test(q)) {
      out.city = name
      break
    }
  }

  for (const [re, flag] of FEATURE_FLAGS) {
    if (re.test(lower)) out[flag] = '1'
  }

  const kw: string[] = []
  for (const t of KEYWORD_TERMS) {
    if (lower.includes(t)) kw.push(t)
  }
  if (kw.length) out.keywords = Array.from(new Set(kw)).join(' ')

  // If nothing structured matched, send the raw query as keywords so the search
  // does a text match instead of returning the entire unfiltered inventory.
  const structured = Object.keys(out).some((k) => k !== 'keywords')
  if (!structured && !out.keywords) out.keywords = q

  return out
}

/** Build the /homes-for-sale URL for a plain-language query. */
export function searchHrefForQuery(raw: string): string {
  const params = new URLSearchParams(parseSearchQuery(raw))
  const qs = params.toString()
  return qs ? `/homes-for-sale?${qs}` : '/homes-for-sale'
}
