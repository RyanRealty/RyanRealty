'use server'

/**
 * Draft a Google review ask for past clients Matt picks (one from the person
 * page, many from a bulk select in the CRM list). NEVER SENDS: each draft
 * waits in his Drafts (/admin/messages?f=drafts) until he opens it and presses
 * Send (Matt 2026-10-14, CLAUDE.md §1 class 1). Principal only, because only
 * the owner of a draft can send it and every review ask needs his yes.
 *
 * Same rules as the closing path (lib/crm/review-ask.ts): never a test or
 * internal person, never someone already asked, never over a broker's own
 * draft, email by default and a text only with SMS consent. A pick may draft
 * again for someone whose earlier draft was discarded unsent.
 */
import { revalidatePath } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm-access'
import { ensureBrokerDirectory } from '@/lib/data/brokers/directory'
import { brokerByFileName, brokerDisplayName } from '@/lib/brokers/directory'
import { decideReviewAskFor, getReviewAskFacts, stageReviewAskDraft } from '@/lib/data/crm/stageReviewAskDraft'
import { latestVaultClosingByPerson } from '@/lib/data/tc/stageReviewAsksForRecentCloses'
import {
  REVIEW_ASK_APPROVER_SLUG,
  REVIEW_ASK_SKIP_WORDS,
  buildReviewAskBody,
  buildReviewAskText,
  reviewAskFirstName,
  reviewAskLedgerKey,
  reviewAskSignerName,
} from '@/lib/crm/review-ask'

/** A bulk pick is a hand-chosen list, not a cohort send. */
const MAX_PICK = 200

export type DraftReviewAskResult =
  | {
      ok: true
      drafted: number
      /** Each person not drafted, with the reason in plain words. */
      skipped: Array<{ personId: number; reason: string }>
    }
  | { ok: false; error: string }

/** People staged at once: a 200-person pick is ~1,200 round trips, not one long chain. */
const CONCURRENCY = 6

export async function draftReviewAskAction(personIds: number[]): Promise<DraftReviewAskResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not signed in.' }
  if (access.role !== 'superuser') return { ok: false, error: 'Review asks are drafted for Matt to approve. Ask him to draft this one.' }
  const ids = [...new Set((Array.isArray(personIds) ? personIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return { ok: false, error: 'Pick at least one person.' }
  if (ids.length > MAX_PICK) return { ok: false, error: `Pick at most ${MAX_PICK} people at a time.` }

  await ensureBrokerDirectory()
  // Every review ask sits in Matt's Drafts, whoever on the principal role picked it.
  const owner = REVIEW_ASK_APPROVER_SLUG
  const signer = reviewAskSignerName(brokerDisplayName(owner))
  const today = new Date().toISOString().slice(0, 10)

  let facts: Awaited<ReturnType<typeof getReviewAskFacts>>
  let closings: Awaited<ReturnType<typeof latestVaultClosingByPerson>>
  try {
    ;[facts, closings] = await Promise.all([getReviewAskFacts(ids, owner), latestVaultClosingByPerson(ids)])
  } catch (e) {
    console.error('[draftReviewAskAction] read', e)
    return { ok: false, error: 'Could not read these contacts. Nothing was drafted.' }
  }

  let drafted = 0
  const skippedById = new Map<number, string>()
  const stageOne = async (personId: number): Promise<void> => {
    const f = facts.get(personId)
    if (!f) {
      skippedById.set(personId, 'not found')
      return
    }
    const decision = await decideReviewAskFor(f, 'picked')
    if (!decision.stage) {
      skippedById.set(personId, REVIEW_ASK_SKIP_WORDS[decision.reason])
      return
    }
    const closing = closings.get(personId) ?? null
    const dealBroker = closing ? brokerByFileName(closing.brokerName) : null
    const draftInput = {
      firstName: reviewAskFirstName(f.person.firstName, f.person.name),
      address: closing?.address ?? null,
      signerFirstName: signer,
      dealBrokerFirstName: dealBroker && dealBroker.slug !== owner ? reviewAskSignerName(dealBroker.fileName) : null,
    }
    const staged = await stageReviewAskDraft({
      personId,
      ownerSlug: owner,
      channel: decision.channel,
      body: decision.channel === 'email' ? buildReviewAskBody(draftInput) : buildReviewAskText(draftInput),
      ledgerKey: reviewAskLedgerKey({ personId, day: today }),
      path: 'picked',
      dealId: closing?.dealId ?? null,
    })
    if (!staged.ok) {
      console.error('[draftReviewAskAction] stage', personId, staged.error)
      skippedById.set(personId, 'could not save the draft')
      return
    }
    if (staged.action === 'created') drafted += 1
    else skippedById.set(personId, REVIEW_ASK_SKIP_WORDS[staged.action === 'already' ? 'already-drafted' : 'draft-slot-taken'])
    revalidatePath(`/admin/people/${personId}`)
  }

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    await Promise.all(ids.slice(i, i + CONCURRENCY).map(stageOne))
  }
  // Report skips in the order Matt picked them.
  const skipped = ids.filter((id) => skippedById.has(id)).map((personId) => ({ personId, reason: skippedById.get(personId)! }))
  revalidatePath('/admin/messages')
  return { ok: true, drafted, skipped }
}
