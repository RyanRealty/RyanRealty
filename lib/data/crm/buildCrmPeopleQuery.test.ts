import { describe, it, expect } from 'vitest'
import { buildCrmPeopleQuery, CRM_PEOPLE_SELECT } from './buildCrmPeopleQuery'
import type { CrmSegment } from '@/lib/crm/segment-ast'
import { EMPTY_SEGMENT } from '@/lib/crm/segment-ast'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A chainable mock query builder that records every method call. Each builder
 * method returns `this`, so the AST compiler can chain freely; the recorded calls
 * let us assert what filters landed on the query.
 */
type Call = { method: string; args: unknown[] }

function makeMockSb(): { sb: SupabaseClient; calls: Call[]; fromArgs: unknown[] } {
  const calls: Call[] = []
  const fromArgs: unknown[] = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    return builder
  }
  for (const m of ['select', 'eq', 'neq', 'or', 'order', 'range', 'in', 'overlaps', 'contains', 'gte', 'lt', 'ilike']) {
    builder[m] = record(m)
  }
  const sb = {
    from: (table: string) => {
      fromArgs.push(table)
      return builder
    },
  } as unknown as SupabaseClient
  return { sb, calls, fromArgs }
}

function eqCalls(calls: Call[]) {
  return calls.filter((c) => c.method === 'eq').map((c) => c.args)
}
function orCalls(calls: Call[]) {
  return calls.filter((c) => c.method === 'or').map((c) => c.args[0] as string)
}

describe('buildCrmPeopleQuery — invariants', () => {
  it('queries crm_people and baselines deleted=false on every query', () => {
    const { sb, calls, fromArgs } = makeMockSb()
    buildCrmPeopleQuery(sb, EMPTY_SEGMENT, null)
    expect(fromArgs).toEqual(['crm_people'])
    expect(eqCalls(calls)).toContainEqual(['deleted', false])
  })

  it('clamps to the broker scope when restricted (a slug is given)', () => {
    const { sb, calls } = makeMockSb()
    buildCrmPeopleQuery(sb, EMPTY_SEGMENT, 'rebecca')
    expect(eqCalls(calls)).toContainEqual(['assigned_broker', 'rebecca'])
  })

  it('does NOT clamp assigned_broker when scope is null (superuser)', () => {
    const { sb, calls } = makeMockSb()
    buildCrmPeopleQuery(sb, EMPTY_SEGMENT, null)
    const brokerEq = eqCalls(calls).filter((a) => a[0] === 'assigned_broker')
    expect(brokerEq).toHaveLength(0)
  })

  it('a restricted broker CANNOT widen past their book even via the AST', () => {
    // The AST asks for paul's contacts, but the caller is scoped to rebecca.
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'assigned_broker', value: 'paul' }],
    }
    buildCrmPeopleQuery(sb, ast, 'rebecca')
    // The hard scope clamp is still applied as a chained .eq — PostgREST ANDs it,
    // so the result is rebecca AND (paul) = empty, never paul's book.
    expect(eqCalls(calls)).toContainEqual(['assigned_broker', 'rebecca'])
  })

  it('selects the row columns for a list query and uses head-count for countOnly', () => {
    const list = makeMockSb()
    buildCrmPeopleQuery(list.sb, EMPTY_SEGMENT, null)
    const listSelect = list.calls.find((c) => c.method === 'select')
    expect(listSelect?.args[0]).toBe(CRM_PEOPLE_SELECT)
    expect((listSelect?.args[1] as { head?: boolean }).head).toBeUndefined()

    const cnt = makeMockSb()
    buildCrmPeopleQuery(cnt.sb, EMPTY_SEGMENT, null, { countOnly: true })
    const cntSelect = cnt.calls.find((c) => c.method === 'select')
    expect(cntSelect?.args[0]).toBe('id')
    expect((cntSelect?.args[1] as { head?: boolean; count?: string }).head).toBe(true)
    expect((cntSelect?.args[1] as { count?: string }).count).toBe('exact')
  })

  it('applies range only for list queries with a limit, never for countOnly', () => {
    const list = makeMockSb()
    buildCrmPeopleQuery(list.sb, EMPTY_SEGMENT, null, { limit: 50, offset: 100 })
    const rangeCall = list.calls.find((c) => c.method === 'range')
    expect(rangeCall?.args).toEqual([100, 149])

    const cnt = makeMockSb()
    buildCrmPeopleQuery(cnt.sb, EMPTY_SEGMENT, null, { countOnly: true, limit: 50 })
    expect(cnt.calls.find((c) => c.method === 'range')).toBeUndefined()
  })
})

describe('buildCrmPeopleQuery — AST translation', () => {
  it('compiles an AND of stage + broker as chained .or fragments', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [
        { field: 'stage', value: 'Lead' },
        { field: 'assigned_broker', value: 'matt' },
      ],
    }
    buildCrmPeopleQuery(sb, ast, null)
    const ors = orCalls(calls)
    expect(ors).toContain('stage.eq.Lead')
    expect(ors).toContain('assigned_broker.eq.matt')
  })

  it('compiles an OR group to a single boolean filter string', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [
        {
          type: 'group',
          op: 'or',
          nodes: [
            { field: 'tag', op: 'has', value: 'a' },
            { field: 'tag', op: 'has', value: 'b' },
          ],
        },
      ],
    }
    buildCrmPeopleQuery(sb, ast, null)
    expect(orCalls(calls)).toContain('or(tags.cs.{a},tags.cs.{b})')
  })

  it('negates a tag with the not. prefix', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'tag', op: 'not', value: 'compliance:hard-stop' }],
    }
    buildCrmPeopleQuery(sb, ast, null)
    expect(orCalls(calls)).toContain('not.tags.cs.{"compliance:hard-stop"}')
  })

  it('expands a free-text q across name + emails + phones (no contact-point cap)', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = { type: 'group', op: 'and', nodes: [{ field: 'q', value: 'jane' }] }
    buildCrmPeopleQuery(sb, ast, null)
    const ors = orCalls(calls)
    // The %...% pattern carries LIKE wildcards, so PostgREST-quotes the value.
    expect(ors).toContain(
      'or(name.ilike."%jane%",emails::text.ilike."%jane%",phones::text.ilike."%jane%")',
    )
    // No .in() id-cap call (the old 200-id contact-point path).
    expect(calls.find((c) => c.method === 'in')).toBeUndefined()
  })

  it('expands a between created condition into two COALESCE(fub_created_at, created_at) bounds', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'created', op: 'between', value: '2026-01-01', valueEnd: '2026-06-01' }],
    }
    buildCrmPeopleQuery(sb, ast, null)
    const ors = orCalls(calls)
    const between = ors.find((s) => s.startsWith('and(or(fub_created_at.gte.'))
    expect(between).toBeDefined()
    // Lower + upper bound both present.
    expect(between).toContain('fub_created_at.gte.')
    expect(between).toContain('fub_created_at.lt.')
    // The native-lead arm: fub_created_at is NULL on every post-cutover row, so
    // each bound falls back to created_at — otherwise created-date filters would
    // silently exclude all native leads.
    expect(between).toContain('and(fub_created_at.is.null,created_at.gte.')
    expect(between).toContain('and(fub_created_at.is.null,created_at.lt.')
  })

  it('compiles a created after condition with the native-lead COALESCE fallback', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'created', op: 'after', value: '2026-06-24' }],
    }
    buildCrmPeopleQuery(sb, ast, null)
    const ors = orCalls(calls)
    const after = ors.find((s) => s.startsWith('or(fub_created_at.gte.'))
    expect(after).toBeDefined()
    expect(after).toContain('and(fub_created_at.is.null,created_at.gte.')
  })

  it('keeps last_activity as a bare last_activity_at bound (no COALESCE)', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'last_activity', op: 'before', value: '2026-06-01' }],
    }
    buildCrmPeopleQuery(sb, ast, null)
    const ors = orCalls(calls)
    expect(ors.find((s) => s.startsWith('last_activity_at.lt.'))).toBeDefined()
  })

  it('compiles a custom-field equality', () => {
    const { sb, calls } = makeMockSb()
    const ast: CrmSegment = {
      type: 'group',
      op: 'and',
      nodes: [{ field: 'custom', key: 'lead_score', op: 'eq', value: 'A' }],
    }
    buildCrmPeopleQuery(sb, ast, null)
    expect(orCalls(calls)).toContain('custom->>lead_score.eq.A')
  })

  it('rejects a malformed AST defensively (validates inside the builder)', () => {
    const { sb } = makeMockSb()
    expect(() => buildCrmPeopleQuery(sb, { foo: 'bar' } as unknown as CrmSegment, null)).toThrow()
  })
})
