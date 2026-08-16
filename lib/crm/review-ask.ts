/**
 * GBP review-ask draft — westside backlog #9 / R-125.
 *
 * Matt 2026-07-29: no engine, no auto-send. On close we stage his ask as a
 * ready CRM email draft with the write-review URL so the ask never depends
 * on memory. Matt (or the assigned broker) sends.
 *
 * This module is PURE. It never writes and never sends. The DAL stager
 * (`lib/data/crm/stageReviewAskDraft.ts`) is the only writer, and it only
 * upserts `crm_message_drafts`.
 */
import { GBP_REVIEW_URL } from '@/lib/brand/contact'

export const REVIEW_ASK_SUBJECT = 'Google review'

export function buildReviewAskBody(address?: string | null): string {
  const place = (address ?? '').trim()
  const lead = place
    ? `If you want to leave a review of the work on ${place}, this link opens the form.`
    : 'If you want to leave a review of the work, this link opens the form.'
  return `${lead}\n\n${GBP_REVIEW_URL}`
}

export function isReviewAskDraft(input: { subject?: string | null; body?: string | null }): boolean {
  const body = input.body ?? ''
  const subject = (input.subject ?? '').trim()
  return subject === REVIEW_ASK_SUBJECT && body.includes(GBP_REVIEW_URL)
}

/** Stage only when entering a closed stage with a linked person. */
export function shouldStageReviewAsk(input: {
  enteringClosedStage: boolean
  wasAlreadyClosed: boolean
  personId: number | null
}): boolean {
  return input.enteringClosedStage && !input.wasAlreadyClosed && input.personId != null && input.personId > 0
}
