/**
 * Correcting a filed email: a broker moves it to a different file, or decides
 * it was never a deal after all. NEW FILE — kept separate from
 * lib/tc/mail-index.ts (which another agent is changing) and never edits
 * lib/tc/mail-rules.ts; both are only imported from here, read-only.
 *
 * A move re-files through fileIndexedMessageToDeal, the exact path any other
 * filing uses (address/escrow/MLS match, a person answering the queue, the
 * auto-open-from-mail sweep), so a corrected message is indistinguishable from
 * one the rules got right the first time. What this file adds on top:
 *
 *  - the OLD deal's documents from that message are released: one nobody has
 *    acted on yet is archived there (archive is the Vault's delete — nothing
 *    is ever hard-deleted) so it stops showing on the wrong file, and the
 *    re-file's own per-cycle dedupe (existingDocumentIdByHash) — hashed by
 *    bytes, scoped to the cycle — picks it straight back up on the new
 *    cycle once fileIndexedMessageToDeal re-reads the message, so it moves
 *    rather than duplicates. A document a person already put to work — on a
 *    checklist, in a signing envelope, in a principal sign-off, or shared
 *    with a client — is left exactly where it is and flagged instead: never
 *    moved, never deleted.
 *  - one tc_events row naming who corrected it, when, and from/to.
 *  - the "every message reviewed" ledger (tc_mail_reviews) gets a stage:
 *    'person' row, so no automated pass ever re-decides a person's decision
 *    (computeIndexResult in mail-index.ts already treats any decided_by other
 *    than 'system' as final; rematchQueuedMail only re-decides decided_by =
 *    'system' rows).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fileIndexedMessageToDeal } from '@/lib/tc/mail-index'
import { MAIL_RULES_VERSION } from '@/lib/tc/mail-rules'

type SB = ReturnType<typeof createServiceClient>

export type MailAttachmentRef = { name?: string; document_id?: string | null }

export type CorrectionResult =
  | { ok: true; message: string; documentsMoved: number; documentsFlagged: number }
  | { ok: false; error: string }

/**
 * A document is already "in use" by a person — never moved out from under
 * them, only flagged — when it:
 *  - sits on a checklist item (tc_checklist_assignments): a broker relies on
 *    what is assigned there for principal sign-off;
 *  - is part of a signing envelope (tc_envelope_documents);
 *  - was named in an actual principal sign-off (tc_principal_reviews,
 *    OAR 863-015-0140 — reviewer_email is always a person);
 *  - is shared with the client (tc_documents.client_visible), or is broker
 *    notes (tc_documents.is_broker_notes) — never mail-derived, but guarded
 *    here too since nothing should ever silently relocate either.
 */
export async function documentTouchedByPerson(sb: SB, documentId: string, cycleId: string | null): Promise<boolean> {
  const principalQuery = cycleId
    ? sb.from('tc_principal_reviews').select('document_ids').eq('cycle_id', cycleId)
    : sb.from('tc_principal_reviews').select('document_ids').limit(0)
  const [{ data: assigned }, { data: envelopeLinked }, { data: principal }, { data: doc }] = await Promise.all([
    sb.from('tc_checklist_assignments').select('item_id').eq('document_id', documentId).limit(1),
    sb.from('tc_envelope_documents').select('id').eq('document_id', documentId).limit(1),
    principalQuery,
    sb.from('tc_documents').select('client_visible, is_broker_notes').eq('id', documentId).maybeSingle(),
  ])
  const principalHit = (principal ?? []).some((r) =>
    ((r.document_ids as unknown[]) ?? []).map(String).includes(documentId),
  )
  return !!(assigned?.length || envelopeLinked?.length || principalHit || doc?.client_visible || doc?.is_broker_notes)
}

/**
 * Release the documents a corrected message put on its OLD deal: archive the
 * ones nobody has acted on (so they stop showing there — the re-file's own
 * per-cycle-hash dedupe reunites them with the message on its new file), and
 * flag-in-place the ones a person already put to work. Never deletes.
 */
async function releaseOldDocuments(input: {
  sb: SB
  oldCycleId: string | null
  attachments: readonly MailAttachmentRef[]
  actor: string
  toDealId: string | null
  note: string
}): Promise<{ archivedIds: string[]; flaggedIds: string[] }> {
  const { sb } = input
  const docIds = [...new Set(input.attachments.map((a) => a.document_id).filter((id): id is string => !!id))]
  const archivedIds: string[] = []
  const flaggedIds: string[] = []
  const now = new Date().toISOString()
  for (const id of docIds) {
    const touched = await documentTouchedByPerson(sb, id, input.oldCycleId)
    if (touched) {
      const { data: current } = await sb.from('tc_documents').select('classification').eq('id', id).maybeSingle()
      const classification = { ...((current?.classification as Record<string, unknown> | null) ?? {}) }
      classification.refile_flag = {
        flagged_at: now,
        flagged_by: input.actor,
        reason: input.note,
        moved_to_deal_id: input.toDealId,
      }
      const { error } = await sb.from('tc_documents').update({ classification }).eq('id', id)
      if (!error) flaggedIds.push(id)
      else console.warn('[mail-refile] flag document', id, error.message)
    } else {
      const { error } = await sb
        .from('tc_documents')
        .update({ archived: true, archived_reason: input.note, archived_at: now })
        .eq('id', id)
      if (!error) archivedIds.push(id)
      else console.warn('[mail-refile] archive document', id, error.message)
    }
  }
  return { archivedIds, flaggedIds }
}

/**
 * Upsert the "every message reviewed" ledger row for a correction that never
 * goes through indexGmailMessage (unfiling a message just updates its status
 * directly — there is no message to re-decide). Fail-open: never blocks the
 * caller. Mirrors the shape of the (unexported) writeMailReview in
 * lib/tc/mail-index.ts, which fileIndexedMessageToDeal already calls for the
 * MOVE path (its actor is a person's email, so it lands with stage 'person'
 * there too — this helper is only needed for the unfile path and for
 * dismissQueuedMail's matching fix in app/actions/tc-mail.ts).
 */
export async function writePersonReview(input: {
  sb: SB
  status: 'filed' | 'dismissed' | 'not_deal'
  messageKey: string | null
  gmailRefs: unknown
  gmailThreadIds: unknown
  sentAt: string | null
  dealId: string | null
  reason: string
}): Promise<void> {
  // One review row per mailbox copy: the same message can sit in several
  // brokers' mailboxes (gmail_refs carries each), and every copy's ledger row
  // must record the person's decision, not only the first.
  const refs = ((input.gmailRefs as Array<{ mailbox?: string; gmail_id?: string }> | null) ?? []).filter(
    (r): r is { mailbox: string; gmail_id: string } => !!r?.mailbox && !!r.gmail_id,
  )
  if (!refs.length) return
  const threadId = ((input.gmailThreadIds as string[] | null) ?? [])[0] ?? null
  const reviewedAt = new Date().toISOString()
  const rows = refs.map((ref) => ({
    mailbox: ref.mailbox,
    gmail_id: ref.gmail_id,
    thread_id: threadId,
    internal_at: input.sentAt,
    status: input.status,
    deal_id: input.dealId,
    message_key: input.messageKey,
    reason: input.reason.slice(0, 400),
    stage: 'person' as const,
    rules_version: MAIL_RULES_VERSION,
    reviewed_at: reviewedAt,
  }))
  const { error } = await input.sb.from('tc_mail_reviews').upsert(rows, { onConflict: 'mailbox,gmail_id' })
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    console.warn('[mail-refile] review write failed (fail-open)', error.message)
  }
}

/**
 * Move a message a person already filed onto a different deal. Re-files
 * through fileIndexedMessageToDeal (same path any filing uses) and releases
 * the old deal's documents from that message (see releaseOldDocuments).
 * Callers own auth/scope: both deals must already be confirmed visible to the
 * caller before this runs.
 */
export async function moveMailToDeal(input: {
  messageId: string
  fromDealId: string
  fromAddress: string
  toDealId: string
  toAddress: string
  actor: string
  sb?: SB
}): Promise<CorrectionResult> {
  const sb = input.sb ?? createServiceClient()
  if (input.toDealId === input.fromDealId) return { ok: false, error: 'Pick a different file.' }
  const { data: row } = await sb
    .from('tc_mail_messages')
    .select('id, status, deal_id, cycle_id, attachments, subject')
    .eq('id', input.messageId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Email not found.' }
  if (row.status !== 'filed' || String(row.deal_id) !== input.fromDealId) {
    return { ok: false, error: 'That email is not filed on this deal — refresh and try again.' }
  }
  const attachments = (row.attachments as MailAttachmentRef[] | null) ?? []
  const oldCycleId = row.cycle_id ? String(row.cycle_id) : null

  const filed = await fileIndexedMessageToDeal({ messageId: input.messageId, dealId: input.toDealId, actor: input.actor, sb })
  if (!filed.ok) return { ok: false, error: filed.error ?? 'Could not file that email to the new deal.' }

  const note = `Moved to ${input.toAddress} by ${input.actor}`
  const { archivedIds, flaggedIds } = await releaseOldDocuments({
    sb,
    oldCycleId,
    attachments,
    actor: input.actor,
    toDealId: input.toDealId,
    note,
  })

  await sb.from('tc_events').insert({
    deal_id: input.fromDealId,
    actor: input.actor,
    action: 'mail_message_moved',
    detail: {
      mail_message_id: input.messageId,
      subject: row.subject,
      from_deal_id: input.fromDealId,
      from_address: input.fromAddress,
      to_deal_id: input.toDealId,
      to_address: input.toAddress,
      documents_moved: archivedIds.length,
      documents_flagged: flaggedIds.length,
      rules_version: MAIL_RULES_VERSION,
    },
  })

  return {
    ok: true,
    message:
      `Moved to ${input.toAddress}.` +
      (flaggedIds.length
        ? ` ${flaggedIds.length} document${flaggedIds.length === 1 ? '' : 's'} already in use stayed on ${input.fromAddress}, flagged.`
        : ''),
    documentsMoved: archivedIds.length,
    documentsFlagged: flaggedIds.length,
  }
}

/**
 * A filed message was never a deal after all: unfile it (status → dismissed,
 * deal_id/cycle_id cleared) and release its documents from the old deal (see
 * releaseOldDocuments). Callers own auth/scope.
 */
export async function unfileMailFromDeal(input: {
  messageId: string
  fromDealId: string
  fromAddress: string
  actor: string
  sb?: SB
}): Promise<CorrectionResult> {
  const sb = input.sb ?? createServiceClient()
  const { data: row } = await sb
    .from('tc_mail_messages')
    .select('id, status, deal_id, cycle_id, attachments, subject, message_key, gmail_refs, gmail_thread_ids, sent_at')
    .eq('id', input.messageId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Email not found.' }
  if (row.status !== 'filed' || String(row.deal_id) !== input.fromDealId) {
    return { ok: false, error: 'That email is not filed on this deal — refresh and try again.' }
  }
  const attachments = (row.attachments as MailAttachmentRef[] | null) ?? []
  const oldCycleId = row.cycle_id ? String(row.cycle_id) : null
  const note = `Not a deal — unfiled from ${input.fromAddress} by ${input.actor}`

  const { archivedIds, flaggedIds } = await releaseOldDocuments({
    sb,
    oldCycleId,
    attachments,
    actor: input.actor,
    toDealId: null,
    note,
  })

  const now = new Date().toISOString()
  const { error } = await sb
    .from('tc_mail_messages')
    .update({ status: 'dismissed', deal_id: null, cycle_id: null, decided_by: input.actor, decided_at: now, updated_at: now })
    .eq('id', input.messageId)
  if (error) return { ok: false, error: 'Could not update that email.' }

  await sb.from('tc_events').insert({
    deal_id: input.fromDealId,
    actor: input.actor,
    action: 'mail_message_unfiled',
    detail: {
      mail_message_id: input.messageId,
      subject: row.subject,
      from_deal_id: input.fromDealId,
      from_address: input.fromAddress,
      to_deal_id: null,
      documents_archived: archivedIds.length,
      documents_flagged: flaggedIds.length,
      rules_version: MAIL_RULES_VERSION,
    },
  })

  await writePersonReview({
    sb,
    status: 'dismissed',
    messageKey: row.message_key ? String(row.message_key) : null,
    gmailRefs: row.gmail_refs,
    gmailThreadIds: row.gmail_thread_ids,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    dealId: null,
    reason: note,
  })

  return {
    ok: true,
    message:
      `Marked not a deal.` +
      (flaggedIds.length
        ? ` ${flaggedIds.length} document${flaggedIds.length === 1 ? '' : 's'} already in use stayed on ${input.fromAddress}, flagged.`
        : ''),
    documentsMoved: archivedIds.length,
    documentsFlagged: flaggedIds.length,
  }
}
