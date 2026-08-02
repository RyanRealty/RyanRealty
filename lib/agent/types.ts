/**
 * lib/agent/types.ts — the broker SMS agent contract.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md. The agent core is transport-agnostic:
 * SMS is the first client. Everything broker-facing flows through these types so
 * the runtime, tools, transport, and tests agree on one shape.
 *
 * Invariants (enforced in code, not prose):
 *  - The agent NEVER messages anyone but a registered broker cell (lib/agent/send.ts
 *    whitelist; gated by scripts/check-broker-agent-send-safety.mjs).
 *  - Every digit-run/$ amount and every ORS/OAR citation in an outbound reply must
 *    trace to a tool result from the current turn (lib/agent/trace.ts).
 *  - Publishing requires the literal token APPROVE (with a job handle when more
 *    than one job awaits approval). Anything else is feedback.
 */

export type BrokerSlug = 'matt' | 'rebecca' | 'paul'

export interface AgentContext {
  brokerSlug: BrokerSlug
  brokerEmail: string
  brokerDisplayName: string
  /** broker_agent_sessions.id */
  sessionId: string
  /** E.164 of the broker cell this conversation rides on. */
  brokerCell: string
}

export interface AgentCitation {
  /** The literal figure/citation string as it appears in the reply (e.g. "$525,000", "ORS 696.820"). */
  figure: string
  /** Named source per §0 (e.g. "market_pulse_live city/redmond refreshed 2026-07-31T17:40Z"). */
  source: string
  detail?: string
}

export interface ToolOutcome {
  /** JSON-serializable result fed back to the model as the tool_result. */
  result: unknown
  /** §0 trace rows for any figures in the result the model may quote. */
  citations?: AgentCitation[]
}

export interface AgentTool {
  name: string
  description: string
  /** JSON Schema for tool input (object schema). */
  input_schema: Record<string, unknown>
  handler: (input: Record<string, unknown>, ctx: AgentContext) => Promise<ToolOutcome>
}

export interface AgentReply {
  /** Plain text, SMS-ready: no markdown, no emoji, numbers carry units. */
  text: string
  /** Optional MMS media (https URLs reachable by Twilio). */
  mediaUrls?: string[]
}

export interface AgentTurnResult {
  reply: AgentReply
  costUsd: number
  toolCallCount: number
  citations: AgentCitation[]
}

/** Deterministic keywords handled before any model call. */
export type AgentKeyword = 'STATUS' | 'RESET' | 'HELP' | 'STOP' | 'APPROVE' | 'HOLD'

export interface AgentSessionRow {
  id: string
  broker_slug: BrokerSlug
  state: Record<string, unknown>
  active_action_ids: string[]
  last_activity_at: string
  created_at: string
  expired_at: string | null
}

/** Job handle surfaced to the broker ("1: CMA Awbrey · 2: IG post Tumalo"). */
export interface AgentJobHandle {
  handle: number
  actionId: string
  label: string
  status: string
}
