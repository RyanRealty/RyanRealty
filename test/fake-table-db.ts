/**
 * An in-memory stand-in for the supabase-js query builder, for unit tests that
 * need real filtering (not just a recorded chain): `.eq/.in/.ilike/.like/.gte/
 * .lte/.is/.not/.order/.range/.limit`, `.maybeSingle()`, and the writes
 * `.insert/.update/.upsert/.delete` against plain arrays of rows.
 *
 * Every write is also appended to `writes`, so a test can assert exactly which
 * tables a code path touched. PostgREST-only behavior (embeds, RPCs, counts)
 * is not modelled.
 */
export type Row = Record<string, unknown>
export type Write = { table: string; op: 'insert' | 'update' | 'upsert' | 'delete'; rows: Row[] }

type Filter = (r: Row) => boolean

function likeToRegExp(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, flags)
}

export function fakeTableDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }))
  const writes: Write[] = []
  let nextId = 1_000_000

  function from(table: string) {
    tables[table] ??= []
    const filters: Filter[] = []
    let op: Write['op'] | 'select' = 'select'
    let payload: Row[] = []
    let patch: Row = {}
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let range: [number, number] | null = null
    let limit: number | null = null
    let order: { col: string; asc: boolean } | null = null
    let single = false

    const run = () => {
      const rows = tables[table]!
      if (op === 'insert' || op === 'upsert') {
        const written: Row[] = []
        for (const p of payload) {
          const key = upsertOpts.onConflict
          const clash = op === 'upsert' && key ? rows.find((r) => r[key] != null && r[key] === p[key]) : undefined
          if (clash) {
            if (!upsertOpts.ignoreDuplicates) Object.assign(clash, p)
            continue
          }
          const row = { id: nextId++, ...p }
          rows.push(row)
          written.push(row)
        }
        writes.push({ table, op, rows: written })
        return { data: written, error: null }
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        for (const r of hit) Object.assign(r, patch)
        writes.push({ table, op, rows: hit })
        return { data: hit, error: null }
      }
      if (op === 'delete') {
        tables[table] = rows.filter((r) => !hit.includes(r))
        writes.push({ table, op, rows: hit })
        return { data: hit, error: null }
      }
      let out = [...hit]
      if (order) {
        const { col, asc } = order
        out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1))
      }
      if (range) out = out.slice(range[0], range[1] + 1)
      if (limit != null) out = out.slice(0, limit)
      if (single) return { data: out[0] ?? null, error: null }
      return { data: out, error: null }
    }

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), chain),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), chain),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), chain),
      not: (c: string, operator: string, v: unknown) => {
        if (operator === 'is') filters.push((r) => (r[c] ?? null) !== v)
        return chain
      },
      gte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) >= v), chain),
      lte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), chain),
      like: (c: string, p: string) => (filters.push((r) => likeToRegExp(p, '').test(String(r[c] ?? ''))), chain),
      ilike: (c: string, p: string) => (filters.push((r) => likeToRegExp(p, 'is').test(String(r[c] ?? ''))), chain),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), chain),
      range: (a: number, b: number) => ((range = [a, b]), chain),
      limit: (n: number) => ((limit = n), chain),
      maybeSingle: () => ((single = true), chain),
      single: () => ((single = true), chain),
      insert: (p: Row | Row[]) => ((op = 'insert'), (payload = Array.isArray(p) ? p : [p]), chain),
      upsert: (p: Row | Row[], o?: { onConflict?: string; ignoreDuplicates?: boolean }) => (
        (op = 'upsert'), (payload = Array.isArray(p) ? p : [p]), (upsertOpts = o ?? {}), chain
      ),
      update: (p: Row) => ((op = 'update'), (patch = p), chain),
      delete: () => ((op = 'delete'), chain),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    return chain
  }

  return { client: { from }, tables: () => tables, writes }
}
