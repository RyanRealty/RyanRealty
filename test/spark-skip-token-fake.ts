/**
 * A fake of Spark's skip-token paging for unit tests (verified live
 * 2026-10-01): results in key order after the token, D.SkipToken the last key
 * of the page, an empty page at the end. The real reader,
 * fetchSparkListingsWhere (lib/spark.ts), is tested against a stubbed fetch in
 * lib/spark-history.test.ts; suites that mock '@/lib/spark' use these two.
 */
type Fields = Record<string, unknown>

/** One skip-token page over these rows. */
export function skipPage(rows: Fields[], opts: { limit?: number; skiptoken?: string }) {
  const after = opts.skiptoken ?? ''
  const page = [...rows]
    .sort((a, b) => String(a.ListingKey).localeCompare(String(b.ListingKey)))
    .filter((f) => String(f.ListingKey) > after)
    .slice(0, opts.limit ?? 1000)
  return {
    D: {
      Results: page.map((f) => ({ StandardFields: f })),
      SkipToken: page.length > 0 ? String(page[page.length - 1]!.ListingKey) : after,
    },
  }
}

/** Every row of a skip-token read, page by page, as fetchSparkListingsWhere returns them. */
export function allPages(rows: Fields[], limit = 1000): { StandardFields: Fields }[] {
  const out: { StandardFields: Fields }[] = []
  for (let token = ''; ; ) {
    const p = skipPage(rows, { limit, skiptoken: token })
    if (p.D.Results.length === 0) return out
    out.push(...p.D.Results)
    token = p.D.SkipToken
  }
}
