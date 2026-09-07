/**
 * GBP review-ask draft — westside backlog #9 / R-125. Body rewritten in the
 * one voice doc 2026-09-07 (marketing_brain_skills/brand-voice/VOICE.md) and
 * mirrored by the crm_templates row `email-google-review`.
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

export const REVIEW_ASK_SUBJECT = 'A quick favor'

export function buildReviewAskBody(address?: string | null): string {
  const place = (address ?? '').trim()
  const thanks = place
    ? `Thank you again for trusting us with ${place}. It meant a lot to work with you.`
    : 'Thank you again for trusting us with your home. It meant a lot to work with you.'
  return [
    'Hi,',
    '',
    thanks,
    '',
    'If you have two minutes, would you leave us a Google review? A few honest sentences about how it went helps the next family in Central Oregon find us. This link opens the review form:',
    '',
    GBP_REVIEW_URL,
    '',
    "Thank you. We're here whenever you need anything real estate, or just have a question about the market.",
    '',
    'Matt Ryan',
    'Ryan Realty | Bend, Oregon',
    '541.703.3095',
  ].join('\n')
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
