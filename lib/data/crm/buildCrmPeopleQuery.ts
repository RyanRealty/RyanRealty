/**
 * buildCrmPeopleQuery — the ONE compiler from a CrmSegment AST to a Supabase
 * query on crm_people. Every list view, headline count, bulk id-set, and Meta
 * audience derives from this, so they can never drift from one another.
 *
 * DAL boundary (G1): this raw .from() builder lives in lib/data/. It returns the
 * unexecuted PostgREST query (or runs a head count) so the caller decides whether
 * to fetch rows, fetch ids for a bulk action, or read a count — all from the same
 * compiled filter.
 *
 * THREE invariants this builder guarantees, applied INSIDE the builder so no
 * caller can forget them:
 *   1. Broker scope is clamped here. A restricted broker's scope slug is applied
 *      as a hard .eq('assigned_broker', slug) AND-ed onto whatever the AST says.
 *      A hand-crafted AST can never widen past the caller's book.
 *   2. .eq('deleted', false) baselined on every query (no soft-deleted rows leak).
 *   3. No 200-id contact-point cap. Free-text q searches name + the emails/phones
 *      jsonb directly via PostgREST `or`, so a phone/email match returns ALL hits.
 *
 * The AST -> PostgREST translation uses PostgREST's `or=(...)` / `and=(...)` filter
 * grammar (via .or(string, { referencedTable })). For an AND group we apply each
 * child as a chained filter (PostgREST ANDs chained filters). For an OR / NOT
 * group we serialize to a single PostgREST boolean-filter string.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmSegment,
  CrmNode,
  CrmGroup,
  CrmCondition,
} from '@/lib/crm/segment-ast'
import { validateSegment } from '@/lib/crm/segment-ast'

export type BuildOptions = {
  limit?: number
  offset?: number
  /** When true, return a head-count instead of a row query. */
  countOnly?: boolean
  /**
   * Override the row projection. Defaults to CRM_PEOPLE_SELECT. The people list
   * reads a few extra columns (price, timeframe, pond_id) it renders but the bulk
   * / audience consumers don't — they pass their superset here so every reader
   * still shares this one compiler (and its scope clamp + deleted baseline).
   * Ignored when countOnly (a head count always selects `id`).
   */
  select?: string
}

/** The columns the people list + bulk consumers read. */
export const CRM_PEOPLE_SELECT =
  'id,fub_legacy_id,name,first_name,last_name,stage,source,assigned_broker,tags,emails,phones,last_activity_at,fub_created_at,picture_url'

// ── PostgREST value escaping ─────────────────────────────────────────────────

/**
 * Escape a value for use inside a PostgREST `or=(...)` boolean-filter string.
 * Values containing PostgREST reserved chars ( , . : ( ) " ) must be wrapped in
 * double quotes with inner quotes doubled. We quote defensively for any value
 * that is not a bare alphanumeric token.
 */
function pgrstValue(v: string): string {
  if (/^[A-Za-z0-9_\-+]+$/.test(v)) return v
  return `"${v.replace(/"/g, '""')}"`
}

/** Escape a value used in an ilike pattern inside a boolean-filter string. */
function pgrstLikePattern(v: string): string {
  // % and _ are LIKE wildcards we want to keep as a "contains" search; the user
  // value itself is wrapped in %...%. Reserved-char quoting still applies.
  const pattern = `%${v}%`
  return pgrstValue(pattern)
}

/** ISO date -> a value PostgREST accepts for a tstz comparison. */
function isoForCompare(v: string): string {
  return new Date(v).toISOString()
}

const DATE_COLUMN: Record<'created' | 'last_activity', string> = {
  created: 'fub_created_at',
  last_activity: 'last_activity_at',
}

/**
 * Serialize a single condition to a PostgREST filter fragment usable inside an
 * `or=(...)` / `and=(...)` string (e.g. `stage.eq.Lead`, `tags.cs.{x}`).
 *
 * Returns one OR MORE fragments. A `between` and a text `q` expand to several
 * fragments that the caller wraps appropriately (between -> AND of two bounds;
 * q -> OR across columns).
 */
function conditionFragments(cond: CrmCondition): { joiner: 'and' | 'or'; fragments: string[] } {
  switch (cond.field) {
    case 'stage':
      return { joiner: 'and', fragments: [`stage.eq.${pgrstValue(cond.value)}`] }
    case 'source':
      return { joiner: 'and', fragments: [`source.eq.${pgrstValue(cond.value)}`] }
    case 'assigned_broker':
      return { joiner: 'and', fragments: [`assigned_broker.eq.${pgrstValue(cond.value)}`] }
    case 'tag':
      // tags is text[]; .cs (contains) tests membership. `not` negates it.
      return {
        joiner: 'and',
        fragments: [`${cond.op === 'not' ? 'not.' : ''}tags.cs.{${pgrstValue(cond.value)}}`],
      }
    case 'created':
    case 'last_activity': {
      const col = DATE_COLUMN[cond.field]
      if (cond.op === 'before') return { joiner: 'and', fragments: [`${col}.lt.${isoForCompare(cond.value)}`] }
      if (cond.op === 'after') return { joiner: 'and', fragments: [`${col}.gte.${isoForCompare(cond.value)}`] }
      // between: inclusive lower, exclusive upper.
      return {
        joiner: 'and',
        fragments: [
          `${col}.gte.${isoForCompare(cond.value)}`,
          `${col}.lt.${isoForCompare(cond.valueEnd as string)}`,
        ],
      }
    }
    case 'q': {
      // Search across name + the emails/phones jsonb (cast to text) — no 200-id
      // contact-point cap. PostgREST allows ilike on a jsonb column cast to text.
      const pat = pgrstLikePattern(cond.value)
      return {
        joiner: 'or',
        fragments: [`name.ilike.${pat}`, `emails::text.ilike.${pat}`, `phones::text.ilike.${pat}`],
      }
    }
    case 'custom': {
      const key = cond.key
      switch (cond.op) {
        case 'has':
          return { joiner: 'and', fragments: [`custom->>${key}.not.is.null`] }
        case 'missing':
          return { joiner: 'and', fragments: [`custom->>${key}.is.null`] }
        case 'eq':
          return { joiner: 'and', fragments: [`custom->>${key}.eq.${pgrstValue(cond.value as string)}`] }
        case 'neq':
          return { joiner: 'and', fragments: [`custom->>${key}.neq.${pgrstValue(cond.value as string)}`] }
        case 'contains':
          return { joiner: 'and', fragments: [`custom->>${key}.ilike.${pgrstLikePattern(cond.value as string)}`] }
      }
      return { joiner: 'and', fragments: [] }
    }
  }
}

function isGroup(node: CrmNode): node is CrmGroup {
  return (node as CrmGroup).type === 'group'
}

/**
 * Serialize a node to a single PostgREST boolean-filter fragment string suitable
 * for embedding inside another `or(...)` / `and(...)`. A leaf condition that
 * expands to multiple fragments is wrapped in its own and(...)/or(...).
 */
function serializeNode(node: CrmNode): string {
  if (isGroup(node)) return serializeGroup(node)
  const { joiner, fragments } = conditionFragments(node)
  if (fragments.length === 1) return fragments[0]
  return `${joiner}(${fragments.join(',')})`
}

function serializeGroup(group: CrmGroup): string {
  if (group.op === 'not') {
    return `not.and(${serializeNode(group.nodes[0])})`
  }
  if (group.nodes.length === 0) {
    // An empty group matches everyone — represent as an always-true fragment.
    return 'id.not.is.null'
  }
  const inner = group.nodes.map(serializeNode).join(',')
  return `${group.op}(${inner})`
}

// ── Applying the AST to a live query ─────────────────────────────────────────

/**
 * Apply an AST node to a PostgREST query builder. The top-level AND group is
 * applied as chained filters (PostgREST ANDs chained filters), which keeps simple
 * filters as first-class predicates; OR / NOT groups and multi-fragment leaves
 * are applied via .or(serialized).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyNode(query: any, node: CrmNode): any {
  if (isGroup(node)) {
    if (node.op === 'and') {
      // AND group at this level -> apply each child as a chained filter.
      let q = query
      for (const child of node.nodes) q = applyNode(q, child)
      return q
    }
    // OR / NOT group -> one serialized boolean filter.
    if (node.op === 'not' || node.nodes.length > 0) {
      return query.or(serializeGroup(node))
    }
    return query
  }

  // Leaf condition.
  const { joiner, fragments } = conditionFragments(node)
  if (fragments.length === 0) return query
  if (joiner === 'or' || fragments.length > 1) {
    // Wrap multi-fragment (between AND, or q OR) into a single boolean filter.
    return query.or(`${joiner}(${fragments.join(',')})`)
  }
  return query.or(fragments[0])
}

export type BuildCrmPeopleQueryResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any
}

/**
 * Compile a CrmSegment into a Supabase query on crm_people.
 *
 * @param sb           a Supabase client (service or scoped).
 * @param ast          the segment AST (validated here defensively).
 * @param brokerScope  the caller's scope slug from scopeBroker() — null = a
 *                     superuser (unrestricted); a slug clamps to that book.
 * @param opts         limit / offset / countOnly.
 *
 * Returns `{ query }`. For rows: `const { data } = await query`. For a bulk id
 * set: select only id (override CRM_PEOPLE_SELECT) — same filter. For a count:
 * pass countOnly and read `count` off the awaited result.
 */
export function buildCrmPeopleQuery(
  sb: SupabaseClient,
  ast: CrmSegment,
  brokerScope: string | null,
  opts: BuildOptions = {},
): BuildCrmPeopleQueryResult {
  // Defensive: never compile a malformed AST into a production query.
  validateSegment(ast)

  const select = opts.countOnly ? 'id' : opts.select ?? CRM_PEOPLE_SELECT
  const selectOpts = opts.countOnly
    ? { count: 'exact' as const, head: true }
    : { count: 'exact' as const }

  let query = sb.from('crm_people').select(select, selectOpts)

  // Invariant 2: soft-deleted rows never leak.
  query = query.eq('deleted', false)

  // Invariant 1: clamp to the caller's book. A restricted broker can NEVER widen
  // past their assigned_broker, regardless of what the AST asks for.
  if (brokerScope) {
    query = query.eq('assigned_broker', brokerScope)
  }

  // Apply the segment filter on top of the baseline.
  query = applyNode(query, ast)

  if (!opts.countOnly) {
    query = query
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('fub_created_at', { ascending: false, nullsFirst: false })
      // Tie-breaker on the unique id so a paged resolve (>1000 rows, used by the
      // bulk id-set + audience resolvers) is fully deterministic. Without it,
      // rows sharing last_activity_at + fub_created_at can reorder between pages,
      // dropping or duplicating ids across the page boundary.
      .order('id', { ascending: true })
    const limit = opts.limit
    if (typeof limit === 'number' && limit > 0) {
      const from = opts.offset ?? 0
      query = query.range(from, from + limit - 1)
    }
  }

  return { query }
}
