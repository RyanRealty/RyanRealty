/**
 * lib/data/agent/digest.ts — DAL for the R3.5 broker-SMS-agent supervision
 * digest (docs/plans/BROKER_SMS_AGENT_2026-07-31.md, Phase 3 + DONE item 7:
 * "Matt receives a daily digest of every broker-initiated action, approval,
 * publish, and law Q&A exchange").
 *
 * Three reads over a trailing window (default 24h):
 *
 *   (a) marketing_brain_actions — every row `generated_by='broker_sms_agent'`
 *       created OR updated in the window (an `.or()` on both timestamp
 *       columns, since a same-day approval/publish only bumps updated_at).
 *       Grouped by `payload->>requested_by_slug` — the broker who asked for
 *       it via `create_action` (R2.2). Rows carrying `approved_by` +
 *       `approved_at` are split out as `selfApproved`: every approval on a
 *       broker_sms_agent row IS the requesting broker's own APPROVE stamp
 *       (§1 amendment), never Matt's, so calling that out by name is the
 *       point of principal-broker supervision.
 *
 *   (b) broker_agent_turns — law Q&A pairs. PostgREST cannot filter a jsonb
 *       column cast to text with ILIKE (no expression filters, only column
 *       filters), so this fetches every turn in the window once and finds
 *       `tool_calls` mentioning `law_lookup` in JS, then walks backward to
 *       the nearest preceding role='broker' turn in the SAME session for the
 *       question text. One fetch, ordered (session_id, created_at) so that
 *       walk is a simple linear scan instead of a second query per hit.
 *
 *   (c) broker_agent_turns.cost_usd — summed per broker (via a second lookup
 *       of broker_agent_sessions.broker_slug for the session ids touched in
 *       the window) — every LLM turn is cost-ledgered (R2.1), so this is the
 *       "nothing is zero cost" line in the digest.
 *
 * All three reads are bounded to a single day for a 3-broker pilot —
 * comfortably under PostgREST's 1,000-row response cap without paging
 * (revisit with fetchPagedRows if the roster or the window ever grows).
 *
 * G1 DAL boundary: every raw .from() call lives here. createServiceClient
 * bypasses RLS — the caller is a cron guarded by requireCronAuth, not a user
 * session.
 */
import { createServiceClient } from '@/lib/supabase/service'

const GENERATED_BY = 'broker_sms_agent'
const UNASSIGNED_SLUG = 'unassigned'

export type BrokerAgentActionRow = {
  id: string
  actionType: string
  target: string
  topic: string
  status: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type BrokerAgentCitation = { figure: string; source: string; detail?: string }

export type BrokerAgentLawQaRow = {
  question: string
  answer: string
  citations: BrokerAgentCitation[]
  occurredAt: string
}

export type BrokerAgentDigestGroup = {
  /** payload->>requested_by_slug, or 'unassigned' when the row carries none. */
  brokerSlug: string
  actions: BrokerAgentActionRow[]
  /** Subset of `actions` with a non-null approved_by + approved_at. */
  selfApproved: BrokerAgentActionRow[]
  lawQa: BrokerAgentLawQaRow[]
  costUsd: number
}

export type BrokerAgentDigestData = {
  windowStartIso: string
  generatedAtIso: string
  groups: BrokerAgentDigestGroup[]
  totalCostUsd: number
  /** false when every group is empty — the caller sends nothing (no
   *  empty-digest noise) rather than mailing a blank report. */
  hasActivity: boolean
}

type ActionRow = {
  id: string
  action_type: string | null
  target: string | null
  topic: string | null
  status: string | null
  approved_by: string | null
  approved_at: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type TurnRow = {
  id: string
  session_id: string
  role: string
  content: Record<string, unknown> | null
  tool_calls: unknown
  citations: unknown
  cost_usd: number | null
  created_at: string
}

function emptyGroup(brokerSlug: string): BrokerAgentDigestGroup {
  return { brokerSlug, actions: [], selfApproved: [], lawQa: [], costUsd: 0 }
}

/** Assembles the last `sinceHours` of broker-SMS-agent activity for the R3.5
 *  supervision digest. Throws on a DB error (the cron surfaces it as a 500 —
 *  a digest that silently ships partial data is worse than a failed cron
 *  Matt notices). */
export async function getBrokerAgentDigest(opts: { sinceHours?: number } = {}): Promise<BrokerAgentDigestData> {
  const sinceHours = opts.sinceHours ?? 24
  const now = new Date()
  const windowStart = new Date(now.getTime() - sinceHours * 60 * 60 * 1000)
  const windowStartIso = windowStart.toISOString()
  const sb = createServiceClient()

  const groups = new Map<string, BrokerAgentDigestGroup>()
  const groupFor = (slug: string): BrokerAgentDigestGroup => {
    const key = slug || UNASSIGNED_SLUG
    let g = groups.get(key)
    if (!g) {
      g = emptyGroup(key)
      groups.set(key, g)
    }
    return g
  }

  // (a) action rows the agent created or moved (approved/published/killed) in
  // the window.
  const { data: actionRows, error: actionErr } = await sb
    .from('marketing_brain_actions')
    .select('id, action_type, target, topic, status, approved_by, approved_at, payload, created_at, updated_at')
    .eq('generated_by', GENERATED_BY)
    .or(`created_at.gte.${windowStartIso},updated_at.gte.${windowStartIso}`)
    .order('created_at', { ascending: true })

  if (actionErr) throw new Error(`[getBrokerAgentDigest] marketing_brain_actions: ${actionErr.message}`)

  for (const row of (actionRows ?? []) as ActionRow[]) {
    const payload = row.payload ?? {}
    const slug = typeof payload.requested_by_slug === 'string' && payload.requested_by_slug
      ? payload.requested_by_slug
      : UNASSIGNED_SLUG
    const action: BrokerAgentActionRow = {
      id: row.id,
      actionType: row.action_type ?? '',
      target: row.target ?? '',
      topic: row.topic ?? '',
      status: row.status ?? '',
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approved_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    const group = groupFor(slug)
    group.actions.push(action)
    if (action.approvedBy && action.approvedAt) group.selfApproved.push(action)
  }

  // (b)+(c) turns in the window — one fetch, two derivations below (law Q&A
  // pairs, per-broker cost totals). Ordered (session_id, created_at) so the
  // "nearest preceding broker turn" walk is a plain linear scan.
  const { data: turnRows, error: turnErr } = await sb
    .from('broker_agent_turns')
    .select('id, session_id, role, content, tool_calls, citations, cost_usd, created_at')
    .gte('created_at', windowStartIso)
    .order('session_id', { ascending: true })
    .order('created_at', { ascending: true })

  if (turnErr) throw new Error(`[getBrokerAgentDigest] broker_agent_turns: ${turnErr.message}`)

  const turns = (turnRows ?? []) as TurnRow[]

  const sessionIds = Array.from(new Set(turns.map((t) => t.session_id)))
  const sessionBrokerSlug = new Map<string, string>()
  if (sessionIds.length > 0) {
    const { data: sessionRows, error: sessionErr } = await sb
      .from('broker_agent_sessions')
      .select('id, broker_slug')
      .in('id', sessionIds)
    if (sessionErr) throw new Error(`[getBrokerAgentDigest] broker_agent_sessions: ${sessionErr.message}`)
    for (const row of (sessionRows ?? []) as Array<{ id: string; broker_slug: string }>) {
      sessionBrokerSlug.set(row.id, row.broker_slug)
    }
  }

  // Nearest preceding role='broker' turn text, per session, walking the
  // (session_id, created_at)-ordered list once. law_lookup detection targets
  // role='tool' rows: lib/data/agent/sessions.ts's appendTurn (the runtime's
  // per-tool-call audit writer — see its file header) is the ONLY place a
  // tool NAME is recorded; the final role='agent' reply row only carries a
  // scalar toolCallCount (lib/agent/types.ts AgentTurnResult), never a tool
  // list. So a law_lookup hit shows up as a 'tool' row, and the pending list
  // below pairs it with citations/answer text once the FOLLOWING 'agent' row
  // (the synthesized reply covering that batch of tool calls) arrives. The
  // own-tool_calls fallback on the 'agent' branch covers the alternate case
  // where a future wiring threads the tool list onto the final row instead —
  // it only fires when nothing is already pending, so a hit is never counted
  // twice.
  const lastQuestion = new Map<string, string>()
  const pendingLaw = new Map<string, Array<{ occurredAt: string }>>()

  const citationsFromTurn = (turn: TurnRow): BrokerAgentCitation[] => {
    const raw = Array.isArray(turn.citations) ? turn.citations : []
    return raw.map((c) => {
      const rec = (c ?? {}) as Record<string, unknown>
      return {
        figure: typeof rec.figure === 'string' ? rec.figure : '',
        source: typeof rec.source === 'string' ? rec.source : '',
        detail: typeof rec.detail === 'string' ? rec.detail : undefined,
      }
    })
  }
  const answerFromTurn = (turn: TurnRow): string =>
    typeof turn.content?.text === 'string' ? turn.content.text : JSON.stringify(turn.content ?? {})

  for (const turn of turns) {
    const slug = sessionBrokerSlug.get(turn.session_id) ?? UNASSIGNED_SLUG
    const group = groupFor(slug)

    if (turn.role === 'broker') {
      const text = typeof turn.content?.text === 'string' ? turn.content.text : ''
      if (text) lastQuestion.set(turn.session_id, text)
      continue
    }

    // PostgREST can serialize `numeric` as a string when precision would be
    // lost as a float; Number(...) here matches the established convention
    // in lib/data/agent/sessions.ts (`row.cost_usd != null ? Number(...) : null`)
    // instead of a strict `typeof === 'number'` check that would silently
    // under-count a string-serialized cost.
    if (turn.role === 'agent' || turn.role === 'tool') {
      const cost = turn.cost_usd != null ? Number(turn.cost_usd) : NaN
      if (Number.isFinite(cost)) group.costUsd += cost
    }

    if (turn.role === 'tool' && /law_lookup/i.test(JSON.stringify(turn.tool_calls ?? []))) {
      const list = pendingLaw.get(turn.session_id) ?? []
      list.push({ occurredAt: turn.created_at })
      pendingLaw.set(turn.session_id, list)
    }

    if (turn.role === 'agent') {
      const pending = pendingLaw.get(turn.session_id)
      const ownMentionsLaw = /law_lookup/i.test(JSON.stringify(turn.tool_calls ?? []))

      if (pending && pending.length > 0) {
        const answer = answerFromTurn(turn)
        const citations = citationsFromTurn(turn)
        const question = lastQuestion.get(turn.session_id) ?? '(question not captured)'
        for (const p of pending) {
          group.lawQa.push({ question, answer, citations, occurredAt: p.occurredAt })
        }
      } else if (ownMentionsLaw) {
        group.lawQa.push({
          question: lastQuestion.get(turn.session_id) ?? '(question not captured)',
          answer: answerFromTurn(turn),
          citations: citationsFromTurn(turn),
          occurredAt: turn.created_at,
        })
      }
      pendingLaw.delete(turn.session_id)
    }
  }

  const groupList = Array.from(groups.values()).sort((a, b) => a.brokerSlug.localeCompare(b.brokerSlug))
  const totalCostUsd = groupList.reduce((sum, g) => sum + g.costUsd, 0)
  const hasActivity = groupList.some((g) => g.actions.length > 0 || g.lawQa.length > 0 || g.costUsd > 0)

  return {
    windowStartIso,
    generatedAtIso: now.toISOString(),
    groups: groupList,
    totalCostUsd,
    hasActivity,
  }
}
