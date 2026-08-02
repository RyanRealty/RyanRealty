/**
 * lib/agent/tools/crm.ts — the `crm_lookup` tool (R2.2).
 *
 * Wraps buildCrmPeopleQuery (lib/data/crm/buildCrmPeopleQuery.ts), the one
 * compiler from a CrmSegment AST to a crm_people query. ctx.brokerSlug is
 * passed as the HARD brokerScope on every call — a broker sees only their own
 * book, and nothing in this tool's input can widen that; the clamp lives
 * inside the compiler itself, per that module's own invariant #1.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { EMPTY_SEGMENT, type CrmSegment, type CrmNode } from '@/lib/crm/segment-ast'
import type { AgentContext, AgentCitation, AgentTool, ToolOutcome } from '@/lib/agent/types'

type ContactEntry = { value?: string; isPrimary?: number | boolean }

function primaryContactValue(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null
  const arr = entries as ContactEntry[]
  const primary = arr.find((e) => e?.isPrimary === 1 || e?.isPrimary === true)
  const chosen = primary ?? arr[0]
  return typeof chosen?.value === 'string' && chosen.value.trim() ? chosen.value.trim() : null
}

async function crmLookupHandler(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const q = typeof input.query === 'string' ? input.query.trim() : ''
  const stage = typeof input.stage === 'string' ? input.stage.trim() : ''

  const nodes: CrmNode[] = []
  if (q) nodes.push({ field: 'q', value: q })
  if (stage) nodes.push({ field: 'stage', value: stage })
  const ast: CrmSegment = nodes.length ? { type: 'group', op: 'and', nodes } : EMPTY_SEGMENT

  const sb = createServiceClient()
  const { query } = buildCrmPeopleQuery(sb, ast, ctx.brokerSlug, { limit: 10 })
  const { data, error } = await query
  if (error) return { result: { error: error.message } }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const people = rows.map((r) => ({
    name: (r.name as string | null) ?? null,
    stage: (r.stage as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    tags: (r.tags as string[] | null) ?? [],
    primaryEmail: primaryContactValue(r.emails),
    primaryPhone: primaryContactValue(r.phones),
    lastActivityAt: (r.last_activity_at as string | null) ?? null,
  }))

  const citations: AgentCitation[] = [
    {
      figure: `${people.length} contacts`,
      source: `crm_people via buildCrmPeopleQuery, assigned_broker=${ctx.brokerSlug}, q=${q || '(none)'}, stage=${stage || '(any)'}`,
    },
  ]

  return { result: { count: people.length, people }, citations }
}

export const crmTools: AgentTool[] = [
  {
    name: 'crm_lookup',
    description:
      "Search YOUR OWN CRM book (never another broker's — the scope is enforced server-side) by free-text name/email/phone and/or stage. Returns up to 10 matches with contact info and last activity.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text name, email, or phone fragment.' },
        stage: { type: 'string', description: 'CRM stage filter, e.g. "Lead", "Client".' },
      },
      required: [],
    },
    handler: crmLookupHandler,
  },
]
