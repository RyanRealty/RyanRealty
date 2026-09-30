// An in-memory stand-in for the tables /api/visitors/track and the identity
// stitch touch (visitor_sessions, visitor_events, visitor_identity_map), for
// route-level tests. It applies the SAME filters the code sends (eq / is null /
// in) and the primary-key uniqueness the tables have, so a test proves which rows
// exist and which were moved, not just which calls were made.
//
// Lives in test/ rather than lib/ because a module only tests import is an
// orphan to ci:reachable-exports.
type Row = Record<string, unknown>
export type FakeVisitorDb = Record<string, Row[]>

const UNIQUE: Record<string, string> = {
  visitor_sessions: 'session_id',
  visitor_identity_map: 'rr_vid',
}

// What Postgres fills in when the route does not (first_seen_at, the score, ...).
const DEFAULTS: Record<string, () => Row> = {
  visitor_sessions: () => ({
    first_seen_at: new Date().toISOString(),
    engagement_score: 0,
    intent_tags: [],
    identified_at: null,
    crm_person_id: null,
    is_automated: false,
    automation_reason: null,
  }),
}

/** Split on commas that are not inside parentheses: `a.eq.1,b.in.(x,y)` -> two terms. */
function splitTopLevel(expr: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of expr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function parseTerm(term: string): (r: Row) => boolean {
  const [col, op, ...rest] = term.split('.')
  const raw = rest.join('.')
  const literal = (v: string): unknown => (v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v)
  if (op === 'eq') return (r) => r[col!] === literal(raw) || String(r[col!]) === raw
  if (op === 'is') return (r) => (r[col!] ?? null) === literal(raw)
  if (op === 'in') {
    const vals = raw.replace(/^\(|\)$/g, '').split(',')
    return (r) => vals.includes(String(r[col!]))
  }
  throw new Error(`fake-visitor-db: unsupported or() operator in "${term}"`)
}

/**
 * PostgREST's `or`: comma-separated `column.operator.value` terms, any of which may
 * match, as one row predicate. The operators the code sends: eq, is (null / true /
 * false), in.(a,b). Exported for the other in-memory fakes of these tables.
 */
export function postgrestOrFilter(expr: string): (r: Row) => boolean {
  const terms = splitTopLevel(expr).map(parseTerm)
  return (r) => terms.some((t) => t(r))
}

export function createFakeVisitorDb() {
  const db: FakeVisitorDb = { visitor_sessions: [], visitor_events: [], visitor_identity_map: [] }

  function builder(table: string) {
    let mode: 'select' | 'update' | 'insert' | 'upsert' = 'select'
    let patch: Row = {}
    let onConflict: string | null = null
    const filters: Array<(r: Row) => boolean> = []
    let returning = false
    const rows = () => (db[table] ??= [])
    const b = {
      // The column list is ignored: whole rows come back.
      select(columns?: string) {
        void columns
        returning = mode !== 'select'
        return b
      },
      update(p: Row) {
        mode = 'update'
        patch = p
        return b
      },
      insert(p: Row) {
        mode = 'insert'
        patch = p
        return b
      },
      upsert(p: Row, opts?: { onConflict?: string }) {
        mode = 'upsert'
        patch = p
        onConflict = opts?.onConflict ?? null
        return b
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val)
        return b
      },
      is(col: string, val: null) {
        filters.push((r) => (r[col] ?? null) === val)
        return b
      },
      in(col: string, vals: unknown[]) {
        filters.push((r) => vals.includes(r[col]))
        return b
      },
      or(expr: string) {
        filters.push(postgrestOrFilter(expr))
        return b
      },
      // The row cap is ignored: every matching row comes back (a test holds a handful).
      limit(n: number) {
        void n
        return b
      },
      order() {
        return b
      },
      maybeSingle() {
        const hit = rows().find((r) => filters.every((f) => f(r)))
        return Promise.resolve({ data: hit ?? null, error: null })
      },
      then(resolve: (v: { data: unknown; error: { code: string; message: string } | null }) => unknown) {
        if (mode === 'update') {
          const hits = rows().filter((r) => filters.every((f) => f(r)))
          for (const r of hits) Object.assign(r, patch)
          return Promise.resolve(resolve({ data: returning ? hits : null, error: null }))
        }
        if (mode === 'insert') {
          const key = UNIQUE[table]
          if (key && rows().some((r) => r[key] === patch[key])) {
            return Promise.resolve(resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }))
          }
          rows().push({ ...(DEFAULTS[table]?.() ?? {}), ...patch })
          return Promise.resolve(resolve({ data: null, error: null }))
        }
        if (mode === 'upsert') {
          const key = onConflict ?? UNIQUE[table] ?? 'id'
          const existing = rows().find((r) => r[key] === patch[key])
          if (existing) Object.assign(existing, patch)
          else rows().push({ ...patch })
          return Promise.resolve(resolve({ data: null, error: null }))
        }
        return Promise.resolve(resolve({ data: rows().filter((r) => filters.every((f) => f(r))), error: null }))
      },
    }
    return b
  }

  return {
    db,
    client: { from: (table: string) => builder(table) },
    reset() {
      db.visitor_sessions = []
      db.visitor_events = []
      db.visitor_identity_map = []
    },
    session(id: string): Row | undefined {
      return db.visitor_sessions.find((r) => r.session_id === id)
    },
  }
}
