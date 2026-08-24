/**
 * Library is the grain of the form catalog. Search and compose filter by
 * library the way SkySlope Browse Libraries does (All libraries, or one).
 * A new market is a new library row — not a mixed pile of every blank.
 */

export type LibraryFilter = 'all' | string

export function parseLibraryFilter(
  raw: string | null | undefined,
  knownCodes: readonly string[],
): LibraryFilter {
  const code = (raw ?? '').trim().toUpperCase()
  if (!code || code === 'ALL') return 'all'
  const known = new Set(knownCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))
  return known.has(code) ? code : 'all'
}

export function libraryRank(code: string): number {
  if (code === 'OREF') return 0
  if (code === 'OR') return 1
  if (code === 'ODS') return 2
  if (code === 'RR') return 3
  return 9
}

export function sortLibraryCodes(codes: readonly string[]): string[] {
  return [...codes].sort(
    (a, b) => libraryRank(a) - libraryRank(b) || a.localeCompare(b),
  )
}

export function matchesLibraryFilter(libraryCode: string, filter: LibraryFilter): boolean {
  if (filter === 'all') return true
  return libraryCode.trim().toUpperCase() === filter
}

export function matchesFormSearch(
  haystack: { formNumber?: string | null; name: string; libraryCode?: string },
  query: string | null | undefined,
): boolean {
  const term = (query ?? '').trim().toLowerCase()
  if (!term) return true
  return `${haystack.formNumber ?? ''} ${haystack.name} ${haystack.libraryCode ?? ''}`
    .toLowerCase()
    .includes(term)
}

export function filterLibraryRows<T extends { libraryCode: string; formNumber?: string | null; name: string }>(
  rows: readonly T[],
  filter: LibraryFilter,
  query?: string | null,
): T[] {
  return rows.filter(
    (row) => matchesLibraryFilter(row.libraryCode, filter) && matchesFormSearch(row, query),
  )
}
