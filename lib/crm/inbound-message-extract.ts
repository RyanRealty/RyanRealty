/**
 * Claude extraction for inbound SMS / voicemail (lib/ai/anthropic CLASSIFIER_MODEL).
 *
 * Fail-soft: missing key, kill switch, timeout, bad JSON, or a thrown SDK
 * error all return null. The caller still writes the transcript note.
 * This module does not send mail or SMS.
 */

import { CLASSIFIER_MODEL, createAnthropic } from '@/lib/ai/anthropic'
import {
  type InboundChannel,
  type InboundExtract,
  normalizeExtract,
} from '@/lib/crm/inbound-message-enrich'

const MODEL_TIMEOUT_MS = 8000

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'first_name',
    'last_name',
    'intent',
    'areas',
    'timing',
    'budget',
    'scam_likely',
    'scam_reasons',
    'confidence',
  ],
  properties: {
    first_name: { type: 'string', description: 'Given name the speaker stated, or empty.' },
    last_name: { type: 'string', description: 'Family name the speaker stated, or empty.' },
    intent: { type: 'string', enum: ['buyer', 'seller', 'other'] },
    areas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Communities or cities they named (Tetherow, Bend, Sunriver, …).',
    },
    timing: { type: 'string', description: 'When they want to buy or sell, or empty.' },
    budget: { type: 'string', description: 'Budget they stated, or empty. Do not invent.' },
    scam_likely: {
      type: 'boolean',
      description: 'True only for generic bulk / cash-buyer / wholesale pitches.',
    },
    scam_reasons: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
} as const

const SYSTEM = `You extract facts from one inbound SMS or voicemail to Ryan Realty (Bend / Central Oregon). Output only the record_extract tool.

Rules:
- first_name / last_name: only a name the speaker claims for themselves ("this is Elize Marais"). Never Matt, Matthew, Ryan, or the brokerage. Empty string if they did not name themselves.
- intent: buyer if they want to purchase a home; seller if they want to sell or ask what a home is worth; other otherwise.
- areas: only places they named. Prefer community names (Tetherow) and cities (Bend).
- timing / budget: only if they stated them. Never invent a number or a date.
- scam_likely: true for generic cash-buyer / wholesale / "any properties in your area" blasts. A person who names themselves and a specific Central Oregon community is not a scam.
- No reply text. Do not draft a message.`

export function buildInboundExtractPrompt(input: {
  body: string
  channel: InboundChannel
  fromNumber?: string | null
}): { system: string; user: string } {
  const user = `Channel: ${input.channel}
From: ${input.fromNumber?.trim() || 'unknown'}

Message:
"""
${(input.body ?? '').slice(0, 2000)}
"""`
  return { system: SYSTEM, user }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('inbound-extract timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/**
 * Structured extract via Claude. Returns null whenever the model cannot run.
 */
export async function extractInboundLeadFacts(input: {
  body: string
  channel: InboundChannel
  fromNumber?: string | null
}): Promise<InboundExtract | null> {
  if (process.env.CRM_INBOUND_ENRICH_DISABLED === '1') return null
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null
  const body = (input.body ?? '').trim()
  if (!body) return null

  const { system, user } = buildInboundExtractPrompt(input)

  try {
    const client = createAnthropic()
    const res = await withTimeout(
      client.messages.create({
        model: CLASSIFIER_MODEL,
        max_tokens: 400,
        system,
        tools: [
          {
            name: 'record_extract',
            description: 'Record the structured inbound-lead extract.',
            input_schema: EXTRACT_SCHEMA as unknown as { type: 'object' },
          },
        ],
        tool_choice: { type: 'tool', name: 'record_extract' },
        messages: [{ role: 'user', content: user }],
      }),
      MODEL_TIMEOUT_MS,
    )
    const use = res.content.find((b) => b.type === 'tool_use')
    if (!use || use.type !== 'tool_use') return null
    return normalizeExtract(use.input, 'model')
  } catch (err) {
    console.warn('[inbound-extract] Claude extract failed (fail-soft)', err)
    return null
  }
}
