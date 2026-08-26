/**
 * lib/studio/spend.ts — what a draft costs, and the cap that stops a bad day.
 *
 * xAI returns `cost_in_usd_ticks` on most calls, but the unit does not
 * reconcile: calibrating against the published rate card gives roughly
 * 5e-12 USD per tick for text and roughly 5e-11 for images, a factor of ten
 * apart (measured 2026-08-26). Until that is resolved we do NOT price from
 * ticks. We price from the published rate card, which is deterministic for
 * the two things that actually cost money here (flat per still, per second
 * of video), and we record the raw ticks beside it so a later reconciliation
 * has the evidence.
 *
 * The cap matters more than the accounting. A runaway loop against a video
 * endpoint is the expensive failure mode, so every producing path checks
 * remaining budget before it spends.
 */
import { GROK_RATES } from '@/lib/grok/client'

export type SpendLine = {
  step: string
  usd: number
  /** Raw xAI figure when it returned one, for later reconciliation. */
  ticks?: number | null
}

export type SpendLedger = {
  lines: SpendLine[]
  totalUsd: number
}

export function newLedger(): SpendLedger {
  return { lines: [], totalUsd: 0 }
}

export function addSpend(ledger: SpendLedger, line: SpendLine): SpendLedger {
  ledger.lines.push(line)
  ledger.totalUsd = Number((ledger.totalUsd + line.usd).toFixed(6))
  return ledger
}

/** Flat per-image rate from the published card. */
export function imageCost(model: string, count: number): number {
  const rates = GROK_RATES.imageUsd as Record<string, number>
  const rate = rates[model] ?? 0.04
  return Number((rate * Math.max(0, count)).toFixed(6))
}

/** Per-second rate from the published card. */
export function videoCost(model: string, seconds: number): number {
  const rates = GROK_RATES.videoUsdPerSecond as Record<string, number>
  const rate = rates[model] ?? 0.08
  return Number((rate * Math.max(0, seconds)).toFixed(6))
}

/**
 * Text and vision are rounding error next to media, but they are not free
 * and a caption retry loop is a real way to waste money, so they are booked
 * at a flat estimate rather than ignored.
 */
export const TEXT_CALL_USD = 0.003
export const VISION_CALL_USD = 0.004

/** Ceiling for one draft. A single draft that exceeds this has gone wrong. */
export const MAX_DRAFT_USD = 1.5

export class SpendCapError extends Error {
  constructor(spent: number, cap: number, step: string) {
    super(
      `Studio spend cap hit before ${step}: $${spent.toFixed(2)} of $${cap.toFixed(2)}. ` +
        'Draft abandoned rather than spending further.',
    )
    this.name = 'SpendCapError'
  }
}

/** Throws before an expensive step when the ledger is already at the cap. */
export function assertBudget(ledger: SpendLedger, nextStepUsd: number, step: string, cap = MAX_DRAFT_USD): void {
  if (ledger.totalUsd + nextStepUsd > cap) {
    throw new SpendCapError(ledger.totalUsd + nextStepUsd, cap, step)
  }
}
