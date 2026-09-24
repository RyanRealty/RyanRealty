import { SEARCH_CANONICAL_STRIP_KEYS } from '@/lib/seo-routing'

/**
 * Which shapes of /homes-for-sale are the regional hub (SITE-201).
 *
 * The bare /homes-for-sale is the one winner for "Central Oregon homes for
 * sale". GSC query x page, 28 days to 2026-09-21: that query's 17
 * impressions went 47% to /homes-for-sale?city=Bend&keywords=Caldera%20High,
 * 29% to /homes-for-sale/bend/north and 24% to /cities/bend; the bare URL got
 * none. Every query-string shape of this template served the same sr-only h1,
 * "Central Oregon homes for sale", and a place filter alone (?city=Bend,
 * ?subdivision=Brasada%20Ranch) was index, follow with a self canonical, so the
 * template was competing with its own hub and with the path pages that own
 * each place.
 *
 * The rule here: the hub is indexable only as the bare URL. Camera state
 * (`view`, `bbox`) and visit tagging (utm_*, click ids, `agent`) do not change
 * the result set, so they neither noindex nor reach the canonical. Any other
 * key with a value is a filtered search: noindex, follow, and its h1 says
 * what it filtered to. The path pages (/homes-for-sale/<city>, the preset and
 * area pages) are the indexable places; they are served by the [...slug]
 * route and are untouched by this file.
 */

type QueryParams = Record<string, string | string[] | undefined>

const CAMERA_KEYS: ReadonlySet<string> = new Set<string>(SEARCH_CANONICAL_STRIP_KEYS)

/** Visit tagging: who sent the visitor, never what they asked for. */
const TAGGING_KEYS: ReadonlySet<string> = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'dclid',
  'ttclid',
  'twclid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  '_gl',
  'agent',
])

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function isTaggingParam(key: string): boolean {
  return key.startsWith('utm_') || TAGGING_KEYS.has(key)
}

/** The query minus visit tagging: what the canonical may carry. */
export function withoutTaggingParams<T extends QueryParams>(sp: T): T {
  const out: QueryParams = {}
  for (const [key, value] of Object.entries(sp)) {
    if (!isTaggingParam(key)) out[key] = value
  }
  return out as T
}

/**
 * True when the URL asks for a result set other than the bare hub's: any
 * key with a value that is not camera state or visit tagging. `page=1` is
 * the hub's own first page.
 */
export function isFilteredHubVariant(sp: QueryParams | undefined): boolean {
  if (!sp) return false
  for (const [key, raw] of Object.entries(sp)) {
    const value = firstValue(raw)?.trim()
    if (!value) continue
    if (CAMERA_KEYS.has(key) || isTaggingParam(key)) continue
    if (key === 'page' && value === '1') continue
    return true
  }
  return false
}
