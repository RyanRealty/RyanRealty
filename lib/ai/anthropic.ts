/**
 * lib/ai/anthropic.ts — the ONE Anthropic client factory + model/pricing registry.
 *
 * R0.4 (docs/plans/BROKER_SMS_AGENT_2026-07-31.md): before this module existed the
 * repo carried five independent Anthropic call sites with drifted model IDs
 * (claude-sonnet-4-5 in three places, claude-sonnet-4-6 in one). New callers import
 * from here; legacy call sites migrate as they are touched.
 *
 * Model roles:
 *  - PRODUCER_MODEL: the legacy text-producer paths (producer-runtime cron,
 *    run-producer one-shot). Kept on the model those paths shipped with so the
 *    R0.4 refactor changes zero behavior. Upgrade deliberately, not as a side
 *    effect of a refactor.
 *  - AGENT_MODEL: the broker SMS agent tool-use loop (Claude Opus 5 — thinking on
 *    by default, no sampling params, tool_use loop per the Claude API docs).
 *  - CLASSIFIER_MODEL: cheap deterministic-ish pre-passes (intent classification).
 */
import Anthropic from '@anthropic-ai/sdk'

export const PRODUCER_MODEL = 'claude-sonnet-4-5'
export const AGENT_MODEL = 'claude-opus-5'
export const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001'

/** USD per single token, keyed by model id. Source: platform.claude.com pricing 2026-07. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 0.000003, output: 0.000015 },
  'claude-opus-5': { input: 0.000005, output: 0.000025 },
  'claude-haiku-4-5-20251001': { input: 0.000001, output: 0.000005 },
}

export function modelCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model]
  if (!p) throw new Error(`lib/ai/anthropic: no pricing entry for model ${model} — add it to PRICING`)
  return inputTokens * p.input + outputTokens * p.output
}

export function createAnthropic(apiKey?: string): Anthropic {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey: key })
}
