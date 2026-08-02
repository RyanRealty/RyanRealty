/**
 * lib/agent/tools/law.ts — the `law_lookup` tool (Phase 4, R4.2/R4.3).
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md
 *
 * One tool, `law_lookup`, with two branches:
 *
 *  (a) DEAL-SPECIFIC — a question about a live transaction or a specific
 *      client ("can my client back out of the Henderson deal") is NEVER
 *      answered here. It is flagged to Matt (the principal broker) and the
 *      model is told to say so plainly. R4.3: the classifier fails OPEN to
 *      "general" on any error (timeout, bad JSON, API failure) — a broken
 *      classifier must never silently swallow a real law question by
 *      accident; the worst case is it gets treated as general and answered
 *      (or flagged for zero corpus hits) instead of being dropped.
 *
 *  (b) GENERAL — a rule question ("do I need a lead-based-paint disclosure on
 *      a 1972 build") is answered ONLY from public.legal_corpus
 *      (lib/data/agent/legal.ts). Zero hits also flags Matt (a real gap in
 *      the corpus should surface, not get silently "no idea"-d). Every hit
 *      returned here becomes an AgentCitation so the runtime's §0 tracer
 *      (lib/agent/trace.ts, R2.3) can verify any ORS/OAR string the model
 *      quotes actually traces to a tool result from this turn.
 *
 * R4.4: every law Q&A (both branches) reaches Matt one way or another — a
 * flag alert for the two "does not answer here" paths, and the
 * broker_agent_turns row (written by the runtime, not here) for the
 * digest either way.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic, CLASSIFIER_MODEL } from '@/lib/ai/anthropic'
import { searchLegalCorpus, flagLawQuestionToMatt } from '@/lib/data/agent/legal'
import type { AgentContext, AgentTool, AgentCitation, ToolOutcome } from '@/lib/agent/types'

/** Twilio/turn budgets are tight — this pre-pass must resolve fast, never stall the turn. */
const CLASSIFIER_TIMEOUT_MS = 5000

const DEAL_SPECIFIC_INSTRUCTION =
  "That's about a live transaction, so I flagged it to Matt as principal broker rather than answering here."

const NOT_IN_CORPUS_INSTRUCTION =
  "This question is not covered by the ingested law corpus. Tell the broker honestly that you don't have a citation for this yet and that it has been flagged to Matt. Never guess at a rule from memory."

const GENERAL_ANSWER_INSTRUCTION =
  'Answer using ONLY the facts in these matched rows — never add a rule, exception, or number that is not present here. ' +
  'The reply MUST quote at least one citation string verbatim exactly as it appears in a row (e.g. "ORS 696.820" or "OAR 863-015-0215") ' +
  'and MUST end with the standing footer: "Informational, not legal advice."'

/**
 * Is `question` about a SPECIFIC live transaction/client, or a GENERAL rule
 * question? Fails open to `false` (general) on any error — a classifier
 * outage must never silently drop a broker's question; worst case it gets
 * answered from the corpus (or flagged for a zero-hit search) instead of a
 * deal-specific question slipping through unanswered.
 */
export async function classifyDealSpecific(question: string): Promise<boolean> {
  try {
    const anthropic = createAnthropic()
    const msg = await anthropic.messages.create(
      {
        model: CLASSIFIER_MODEL,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content:
              'A real estate broker sent this question to a law-lookup assistant:\n\n' +
              `"${question}"\n\n` +
              'Decide: is this a GENERAL Oregon real-estate-law/rule question (asking what the ' +
              'law or rule says in the abstract, e.g. "do I need a lead-based-paint disclosure ' +
              'on a pre-1978 build", "how long do I have to keep transaction records"), or is it ' +
              'asking for advice about a SPECIFIC live transaction or a named client\'s deal ' +
              '(mentions a specific address, a client by name, "my deal", "can my client", a live ' +
              'negotiation or dispute)?\n\n' +
              'Reply with ONLY this JSON and nothing else: {"dealSpecific": true} or {"dealSpecific": false}',
          },
        ],
      },
      { timeout: CLASSIFIER_TIMEOUT_MS }
    )

    const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return false
    const parsed = JSON.parse(jsonMatch[0]) as { dealSpecific?: unknown }
    return parsed.dealSpecific === true
  } catch (err) {
    console.warn('[law_lookup] classifyDealSpecific failed, failing open to general:', err)
    return false
  }
}

async function lawLookupHandler(input: Record<string, unknown>, ctx: AgentContext): Promise<ToolOutcome> {
  const question = typeof input.question === 'string' ? input.question.trim() : ''
  if (!question) {
    return { result: { ok: false, message: 'No question was provided to law_lookup.' } }
  }

  const dealSpecific = await classifyDealSpecific(question)

  if (dealSpecific) {
    const flagged = await flagLawQuestionToMatt({ brokerSlug: ctx.brokerSlug, question, reason: 'deal-specific' })
    return {
      result: {
        ok: true,
        dealSpecific: true,
        flaggedToMatt: flagged,
        instruction: DEAL_SPECIFIC_INSTRUCTION,
      },
    }
  }

  const hits = await searchLegalCorpus(question, 5)

  if (hits.length === 0) {
    const flagged = await flagLawQuestionToMatt({ brokerSlug: ctx.brokerSlug, question, reason: 'not-in-corpus' })
    return {
      result: {
        ok: true,
        dealSpecific: false,
        hits: [],
        flaggedToMatt: flagged,
        instruction: NOT_IN_CORPUS_INSTRUCTION,
      },
    }
  }

  const citations: AgentCitation[] = hits.map((h) => ({
    figure: h.citation,
    source: `legal_corpus ${h.corpusVersion} ${h.url ?? 'no-url'}`,
    detail: h.heading ?? undefined,
  }))

  return {
    result: {
      ok: true,
      dealSpecific: false,
      hits,
      instruction: GENERAL_ANSWER_INSTRUCTION,
    },
    citations,
  }
}

/**
 * Tool factory — matches the shared convention every Phase 2 tool group
 * follows (`xTools(ctx): AgentTool[]`), even though `law_lookup`'s handler
 * only needs the `ctx` the runtime passes into `handler` at call time (for
 * `brokerSlug`), not anything closed over at construction.
 */
export function lawTools(_ctx: AgentContext): AgentTool[] {
  return [
    {
      name: 'law_lookup',
      description:
        "Look up an Oregon real-estate law/rule question (ORS chapter 696, OAR chapter 863, and Ryan Realty's " +
        'in-house TC compliance matrix). Use this for ANY question about what the law or a rule requires — ' +
        'disclosures, licensing, agency, recordkeeping, well/septic/lead-paint rules, etc. A question naming a ' +
        "specific client or live deal is NOT answered here — it is routed to Matt, the firm's principal broker. " +
        'Every answer sourced from this tool must carry its citation string and end with "Informational, not legal advice."',
      input_schema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: "The broker's law question, verbatim.",
          },
        },
        required: ['question'],
      },
      handler: lawLookupHandler,
    },
  ]
}
