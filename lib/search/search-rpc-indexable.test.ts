import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * search_listings_advanced, the Sold / off-market / legacy-routed list read,
 * timed out on Sold and on city scopes (2026-09-24 12:14Z, through PostgREST
 * as anon: Bend active, Bend Sold and no-city Sold all cancelled at the
 * function's 12 s statement_timeout, against the page's 4 s). The fix
 * (migration 20260924052526) may change the plan and nothing else. These pin
 * the parts of it that keep the answer the same:
 *
 *  - the two index conjuncts are IMPLIED by predicates that stay in base, so
 *    no row is dropped or added: the status-value step evaluates the very
 *    chain base evaluates, re-pointed at a candidate value;
 *  - full_count is still every row base matches, counted once, with the window
 *    gone (the window is what forced the whole matching set through the heap);
 *  - the partial indexes the Sold page walks are provable from the closed
 *    scope's own predicate and are in the page's order.
 */

const dir = join(__dirname, '..', '..', 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const lastDefining = (fn: string) =>
  files.filter((f) => readFileSync(join(dir, f), 'utf8').includes(`CREATE OR REPLACE FUNCTION public.${fn}(`)).at(-1)!

const file = lastDefining('search_listings_advanced')
const sql = readFileSync(join(dir, file), 'utf8')
const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.search_listings_advanced('), sql.indexOf('$function$;'))
const code = fn.replace(/--[^\n]*/g, '')

/** base's status chain: from its first line to the off-market guard after it. */
function baseStatusChain(): string {
  const baseStart = code.indexOf('WITH base AS NOT MATERIALIZED (')
  expect(baseStart).toBeGreaterThan(0)
  const start = code.indexOf("      AND (p_status_filter IS NULL OR p_status_filter = 'all'", baseStart)
  const end = code.indexOf('      AND (p_off_market_within_days IS NULL', baseStart)
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  return code.slice(start, end).trim()
}

/** The status-value step's chain: after the Coming Soon test, up to its ';'. */
function valueStatusChain(): string {
  const anchor = "     WHERE lower(COALESCE(c.v, '')) NOT LIKE 'coming%soon%'\n"
  const start = code.indexOf(anchor)
  expect(start).toBeGreaterThan(0)
  const rest = code.slice(start + anchor.length)
  return rest.slice(0, rest.indexOf(';')).trim()
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('search_listings_advanced: the fix changes the plan, not the answer', () => {
  it('is the 20260924 definition, applied after 20260923230000', () => {
    expect(file).toBe('20260924052526_search_indexable_scope_count.sql')
    expect(sql).toContain('APPLY AFTER 20260923230000')
  })

  it('the status values are the base chain evaluated per value (same text, column re-pointed)', () => {
    const base = baseStatusChain()
    expect(base.match(/l\."StandardStatus"/g)?.length).toBe(21)
    expect(squash(valueStatusChain())).toBe(squash(base.replace(/l\."StandardStatus"/g, 'c.v')))
    // The value step also applies base's unconditional Coming Soon exclusion.
    expect(code).toContain("lower(COALESCE(l.\"StandardStatus\", '')) NOT LIKE 'coming%soon%'")
    expect(code).toContain("WHERE lower(COALESCE(c.v, '')) NOT LIKE 'coming%soon%'")
    // Every distinct value, plus the NULL candidate the active scopes admit.
    expect(code).toMatch(/WITH RECURSIVE status_values\(v\)/)
    expect(code).toMatch(/UNION ALL\s+SELECT NULL::text/)
  })

  it('the two conjuncts sit in base beside, not instead of, the predicates they are implied by', () => {
    const baseStart = code.indexOf('WITH base AS NOT MATERIALIZED (')
    const baseEnd = code.indexOf('  page AS (')
    const base = code.slice(baseStart, baseEnd)
    expect(base).toContain('AND (p_city IS NULL OR l."City" ILIKE p_city)')
    expect(base).toContain(
      "AND (v_city_key IS NULL OR lower(TRIM(BOTH FROM COALESCE(l.\"City\", ''))) = v_city_key)",
    )
    expect(squash(base)).toContain(
      squash(`AND (v_status_values IS NULL
        OR l."StandardStatus" = ANY(v_status_values)
        OR (v_status_null AND l."StandardStatus" IS NULL))`),
    )
    // No city key for a pattern with a LIKE metacharacter (%, _, backslash).
    expect(code).toMatch(
      /strpos\(p_city, '%'\) = 0 AND strpos\(p_city, '_'\) = 0 AND strpos\(p_city, chr\(92\)\) = 0/,
    )
    expect(code).toContain('v_city_key := lower(btrim(p_city));')
  })

  it('full_count is one count of base, with the window gone', () => {
    expect(code).not.toMatch(/count\(\*\)\s+OVER/i)
    expect(code).toContain('WITH base AS NOT MATERIALIZED (')
    expect(code).toContain('l2.details, (SELECT count(*) FROM base)')
    expect(code).not.toContain('page.fc')
    expect(fn).toContain("SET plan_cache_mode TO 'force_custom_plan'")
    // The caller-visible shape is untouched.
    expect(fn).toContain('full_count bigint')
    expect(fn).toContain('SECURITY DEFINER')
    expect(fn).toContain("SET statement_timeout TO '12s'")
  })

  it('the Sold page index is provable from the closed scope and is in the page order', () => {
    expect(code).toContain("OR (p_status_filter = 'closed' AND l.\"StandardStatus\" ILIKE '%Closed%')")
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_listings_closed_recent_sold\s+ON public\.listings \("CloseDate" DESC NULLS LAST, "ListNumber"\)[\s\S]*?WHERE "StandardStatus" ILIKE '%Closed%';/,
    )
    // The page orders the Sold scope by the close date, newest first, ties on the list number.
    expect(code).toContain(`CASE WHEN p_status_filter = 'closed' THEN l."CloseDate" ELSE l."OnMarketDate" END AS s_sort_date`)
    expect(code).toMatch(/p_sort = 'newest' OR p_sort IS NULL THEN base\.s_sort_date END DESC NULLS LAST/)
    expect(code).toMatch(/base\.k ASC\s*\n\s*LIMIT p_limit/)
    // A city's Sold page and count: the same, keyed first by the city key, the
    // conjunct's own expression (the planner matches index expressions by text).
    const cityKey = `lower(TRIM(BOTH FROM COALESCE("City", '')))`
    expect(code).toContain(`AND (v_city_key IS NULL OR ${cityKey.replace('"City"', 'l."City"')} = v_city_key)`)
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_listings_closed_city_recent_sold\s+ON public\.listings \(lower\(TRIM\(BOTH FROM COALESCE\("City", ''\)\)\), "CloseDate" DESC NULLS LAST, "ListNumber"\)[\s\S]*?WHERE "StandardStatus" ILIKE '%Closed%';/,
    )
    // The Sold split view's tile read has its own: close_date order, 'Closed' only.
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS listing_tile_mv_closed_recent_sold\s+ON public\.listing_tile_mv_src \(close_date DESC NULLS LAST, listing_key\)[\s\S]*?WHERE standard_status = 'Closed';/,
    )
  })

  it('the three Coming Soon exclusions and the grants are still there', () => {
    expect(code.match(/NOT LIKE 'coming%soon%'/g)?.length).toBe(4) // base, EXISTS, projection, value step
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_listings_advanced\([\s\S]*?\) TO anon, authenticated, service_role;/)
  })
})
