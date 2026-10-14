/**
 * The rows the /homes-for-sale search field (SearchFilters, the morph field in
 * the filter dock) offers, as MorphingSearch items. Pure; tested in
 * __tests__/search-field-rows.test.ts.
 *
 * THE FIELD THAT COULD NOT BE TYPED IN (2026-09-10 to 2026-10-14). The dock
 * bound the morph's `open` to "there are suggestions". Suggestions need typed
 * words, and MorphingSearch clears its query each time it opens, so the second
 * letter opened the panel, the open cleared the words, the empty words closed
 * it. No search was possible there, and the Website view's search card went
 * empty. The field now opens on focus like the header and homepage searches,
 * onto the city seeds below until suggestions arrive.
 */
import type { MorphingSearchItem } from '@/components/motion/morphing-search'
import type { SuggestItem } from '@/components/search/SearchSuggest'
import { parseSearchQuery } from '@/lib/parse-search-query'

/** Id prefix of the row that applies the typed words as a sentence search. */
export const TYPED_SEARCH_ROW_PREFIX = 'typed:'

/** City rows the field opens onto before anything is typed. A pick filters to the city in place. */
export function citySeedRows(cities: readonly string[]): SuggestItem[] {
  return cities.map((city) => ({
    kind: 'city',
    label: city,
    sublabel: 'City',
    href: `/homes-for-sale?city=${encodeURIComponent(city)}`,
    city,
  }))
}

/** Server suggestions for the typed words when there are any, else the seeds. */
export function searchFieldRows(
  suggestions: readonly SuggestItem[],
  seeds: readonly SuggestItem[],
): readonly SuggestItem[] {
  return suggestions.length > 0 ? suggestions : seeds
}

/**
 * MorphingSearch items for `rows`, keyed by href.
 *
 * - No row carries its own onSelect. MorphingSearch calls a row's onSelect AND
 *   its onSelect prop, so a row handler recorded every pick twice.
 * - Server rows that answer exactly these typed words carry them as a keyword,
 *   so MorphingSearch's own substring filter cannot drop a match the server made
 *   on a field the row does not print (V3ChromeSearch does the same). Seeds, and
 *   suggestions still left from earlier words, do not: the typed words narrow
 *   them ("Re" leaves Redmond, and a stale "Bend" row leaves once "Bend 3 bed"
 *   is typed), so Enter cannot pick a row the words have moved past.
 * - A row applies the typed words as a sentence (lib/parse-search-query.ts) when
 *   no row already names them, and they read as filters ("3 bed in Tetherow")
 *   or no other row would show. Filter words put it FIRST, so Enter applies
 *   every filter rather than only the place a row matched; plain words put it
 *   last. Enter takes the first row, so without it Enter on words that match no
 *   place did nothing; the field before the morph applied them on Enter.
 */
export function searchFieldItems(
  rows: readonly SuggestItem[],
  query: string,
  opts: { answersQuery: boolean },
): MorphingSearchItem[] {
  const text = query.trim()
  const items: MorphingSearchItem[] = rows.map((row) => ({
    id: row.href,
    title: row.label,
    description: row.sublabel,
    ...(opts.answersQuery && text ? { keywords: [text] } : {}),
  }))
  if (text.length < 2) return items
  const needle = text.toLowerCase()
  if (rows.some((row) => row.label.trim().toLowerCase() === needle)) return items
  const shown = opts.answersQuery
    ? rows.length
    : rows.filter((row) => `${row.label} ${row.sublabel ?? ''}`.toLowerCase().includes(needle)).length
  const filters = Object.keys(parseSearchQuery(text)).some((key) => key !== 'keywords')
  const typed: MorphingSearchItem = { id: `${TYPED_SEARCH_ROW_PREFIX}${text}`, title: text, description: 'Search homes' }
  if (filters) return [typed, ...items]
  if (shown === 0) return [...items, typed]
  return items
}
