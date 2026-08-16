/**
 * Stage a GBP review-ask as a CRM email draft. Never sends.
 *
 * Westside backlog #9: on deal close, the ask lives in crm_message_drafts so
 * the broker can send Matt's template from the inbox. A broker-authored draft
 * on the same (person, broker, email) slot is left alone.
 */
import 'server-only'
import { getDraftsForPerson, upsertDraft } from '@/lib/data/crm/drafts'
import {
  REVIEW_ASK_SUBJECT,
  buildReviewAskBody,
  isReviewAskDraft,
} from '@/lib/crm/review-ask'

export type StageReviewAskResult =
  | { ok: true; action: 'created' | 'already' | 'skipped-existing-draft' }
  | { ok: false; error: string }

export async function stageReviewAskDraft(input: {
  personId: number
  brokerSlug: string | null
  address?: string | null
}): Promise<StageReviewAskResult> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) {
    return { ok: false, error: 'personId is required' }
  }
  const existing = await getDraftsForPerson(input.personId, input.brokerSlug)
  if (existing.email) {
    if (isReviewAskDraft(existing.email)) return { ok: true, action: 'already' }
    return { ok: true, action: 'skipped-existing-draft' }
  }
  const wrote = await upsertDraft({
    personId: input.personId,
    brokerSlug: input.brokerSlug,
    channel: 'email',
    subject: REVIEW_ASK_SUBJECT,
    body: buildReviewAskBody(input.address),
  })
  if (!wrote.ok) return { ok: false, error: wrote.error }
  return { ok: true, action: 'created' }
}
