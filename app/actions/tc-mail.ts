'use server'

/**
 * The mail queue's answers. The rules file mail on their own; a person only
 * answers what they could not decide: which of several files an email belongs
 * to, or whether transaction mail for a property with no file should open one.
 * Every answer is recorded on the index row (decided_by) and in tc_events.
 */
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { BROKER_FILE_EMAIL, dealVisibleToBroker, fileNameFromBrokerSlug } from '@/lib/tc/deal-scope'
import { fileIndexedMessageToDeal, openInboundFile, sweepDealMail } from '@/lib/tc/mail-index'
import { moveMailToDeal, unfileMailFromDeal, writePersonReview } from '@/lib/tc/mail-refile'
import { getDealScopeRow, getMailMessagesForAction, type MailMessageForAction } from '@/lib/data/tc/mail-reads'

type Result = { ok: true; message?: string; dealKey?: string } | { ok: false; error: string }

async function ctxForEdit() {
  const auth = await checkAdminAction('transactions.edit')
  if (!auth.ok) return { error: auth.error }
  const ctx = auth.ctx
  const ownMailbox = ctx.role === 'superuser' ? null : BROKER_FILE_EMAIL[fileNameFromBrokerSlug(ctx.brokerSlug) ?? ''] ?? '__none__'
  return { ctx, ownMailbox }
}

async function loadMessages(ids: string[], ownMailbox: string | null) {
  const rows = await getMailMessagesForAction(ids)
  if (rows.length !== ids.length) return { error: 'Some emails were not found.' as const }
  if (ownMailbox) {
    const foreign = rows.some(
      (r) => !((r.gmail_refs as Array<{ mailbox?: string }> | null) ?? []).some((g) => g.mailbox === ownMailbox),
    )
    if (foreign) return { error: 'You can only file email from your own mailbox.' as const }
  }
  return { rows }
}

async function dealFor(dealId: string, ctx: { role: string; brokerSlug: string | null }) {
  const deal = await getDealScopeRow(dealId)
  if (!deal) return null
  if (!dealVisibleToBroker({ role: ctx.role as 'superuser' | 'broker', brokerSlug: ctx.brokerSlug, dealBrokerName: deal.broker_name })) return null
  return deal
}

/** File queued email onto a deal. */
export async function fileQueuedMail(input: { messageIds: string[]; dealId: string }): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const ids = [...new Set(input.messageIds)].slice(0, 100)
  if (!ids.length) return { ok: false, error: 'Pick at least one email.' }
  const loaded = await loadMessages(ids, auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }
  const deal = await dealFor(input.dealId, auth.ctx)
  if (!deal) return { ok: false, error: 'Deal not found.' }
  const sb = createServiceClient()
  let docs = 0
  for (const id of ids) {
    const r = await fileIndexedMessageToDeal({ messageId: id, dealId: deal.id, actor: auth.ctx.email })
    if (!r.ok) return { ok: false, error: r.error ?? 'Could not file that email.' }
    docs += r.documents ?? 0
  }
  await sb.from('tc_events').insert({
    deal_id: deal.id,
    actor: auth.ctx.email,
    action: 'mail_assigned',
    detail: { mail_message_ids: ids, subjects: loaded.rows.map((r) => r.subject).slice(0, 10), documents: docs },
  })
  revalidatePath(`/admin/deals/${deal.property_key}`)
  revalidatePath('/admin/closings/mail')
  return { ok: true, message: `Filed ${ids.length} email${ids.length === 1 ? '' : 's'} to ${deal.address}.`, dealKey: deal.property_key }
}

/**
 * Not transaction mail after all. Kept on the index as dismissed, never
 * deleted — and, per docs/TC_MAIL_FILING_RULES.md "Every message reviewed",
 * writes a tc_events row and a tc_mail_reviews row (stage 'person') for each
 * one, same as any other person decision.
 */
export async function dismissQueuedMail(input: { messageIds: string[]; reason?: string }): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const ids = [...new Set(input.messageIds)].slice(0, 200)
  const loaded = await loadMessages(ids, auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }
  const sb = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await sb
    .from('tc_mail_messages')
    .update({ status: 'dismissed', decided_by: auth.ctx.email, decided_at: now, updated_at: now })
    .in('id', ids)
  if (error) return { ok: false, error: 'Could not update those emails.' }
  const rows = loaded.rows as MailMessageForAction[]
  const reason = `dismissed: not a deal (by ${auth.ctx.email})${input.reason ? ` — ${input.reason}` : ''}`
  await sb.from('tc_events').insert(
    rows.map((r) => ({
      deal_id: r.deal_id ?? null,
      actor: auth.ctx.email,
      action: 'mail_dismissed',
      detail: { mail_message_id: r.id, subject: r.subject, reason: input.reason ?? null },
    })),
  )
  await Promise.all(
    rows.map((r) =>
      writePersonReview({
        sb,
        status: 'dismissed',
        messageKey: r.message_key,
        gmailRefs: r.gmail_refs,
        gmailThreadIds: r.gmail_thread_ids,
        sentAt: r.sent_at,
        dealId: r.deal_id ?? null,
        reason,
      }),
    ),
  )
  revalidatePath('/admin/closings/mail')
  return { ok: true, message: `Marked ${ids.length} email${ids.length === 1 ? '' : 's'} as not a deal.` }
}

/**
 * Open a file for a property that only exists in email so far, and file that
 * email onto it. The new file starts before contract; the broker confirms the
 * side and adds the clients on the deal page.
 */
export async function openFileFromQueuedMail(input: {
  messageIds: string[]
  address: string
  representation: 'seller' | 'buyer'
}): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const address = input.address.trim()
  if (address.length < 6 || !/\d/.test(address)) return { ok: false, error: 'Enter the full street address.' }
  const ids = [...new Set(input.messageIds)].slice(0, 100)
  if (!ids.length) return { ok: false, error: 'Pick at least one email.' }
  const loaded = await loadMessages(ids, auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }

  const opened = await openInboundFile({
    address,
    brokerName: fileNameFromBrokerSlug(auth.ctx.brokerSlug) ?? 'Matt Ryan',
    representation: input.representation,
    actor: auth.ctx.email,
    reason: 'opened from the mail queue',
    mailIds: ids,
  })
  if ('error' in opened) return { ok: false, error: opened.error }
  const { dealId, propertyKey } = opened
  for (const id of ids) {
    const r = await fileIndexedMessageToDeal({ messageId: id, dealId, actor: auth.ctx.email })
    if (!r.ok) return { ok: false, error: r.error ?? 'File opened, but an email could not be filed.' }
  }
  revalidatePath('/admin/closings')
  revalidatePath('/admin/closings/mail')
  return { ok: true, message: `Opened ${address} and filed ${ids.length} email${ids.length === 1 ? '' : 's'}.`, dealKey: propertyKey }
}

/**
 * A filed email is on the wrong file — move it to another one the broker can
 * see (a correction). Re-files through the exact path fileIndexedMessageToDeal
 * uses; the old deal's documents from that message are released (moved with
 * it, unless a person already put one to work, which is left and flagged —
 * see lib/tc/mail-refile.ts). decided_by is set to the broker, so no
 * automated pass ever re-decides this again.
 */
export async function moveFiledMailToDeal(input: { messageId: string; toDealId: string }): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const loaded = await loadMessages([input.messageId], auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }
  const row = loaded.rows[0]
  if (!row.deal_id) return { ok: false, error: 'That email is not filed to a deal.' }
  const fromDeal = await dealFor(row.deal_id, auth.ctx)
  if (!fromDeal) return { ok: false, error: 'Deal not found.' }
  const toDeal = await dealFor(input.toDealId, auth.ctx)
  if (!toDeal) return { ok: false, error: 'Pick a file you can see.' }
  const result = await moveMailToDeal({
    messageId: input.messageId,
    fromDealId: fromDeal.id,
    fromAddress: fromDeal.address,
    toDealId: toDeal.id,
    toAddress: toDeal.address,
    actor: auth.ctx.email,
  })
  if (!result.ok) return result
  revalidatePath(`/admin/deals/${fromDeal.property_key}`)
  revalidatePath(`/admin/deals/${toDeal.property_key}`)
  return { ok: true, message: result.message, dealKey: toDeal.property_key }
}

/**
 * A filed email was never a deal after all — unfile it (a correction). Kept
 * on the index as dismissed, never deleted; documents it put on the file are
 * released the same way a move releases them.
 */
export async function unfileDealMail(input: { messageId: string }): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const loaded = await loadMessages([input.messageId], auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }
  const row = loaded.rows[0]
  if (!row.deal_id) return { ok: false, error: 'That email is not filed to a deal.' }
  const deal = await dealFor(row.deal_id, auth.ctx)
  if (!deal) return { ok: false, error: 'Deal not found.' }
  const result = await unfileMailFromDeal({
    messageId: input.messageId,
    fromDealId: deal.id,
    fromAddress: deal.address,
    actor: auth.ctx.email,
  })
  if (!result.ok) return result
  revalidatePath(`/admin/deals/${deal.property_key}`)
  return { ok: true, message: result.message }
}

/** Search every mailbox again for this deal (address, escrow and MLS numbers). */
export async function resweepDealMail(dealId: string): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const deal = await dealFor(dealId, auth.ctx)
  if (!deal) return { ok: false, error: 'Deal not found.' }
  const res = await sweepDealMail({ dealId })
  if (!res) return { ok: false, error: 'This deal has no address or escrow number to search for.' }
  revalidatePath(`/admin/deals/${deal.property_key}`)
  return {
    ok: true,
    message: `Checked ${res.seen} email${res.seen === 1 ? '' : 's'}: ${res.filed} on this file, ${res.queued} waiting in the mail queue.`,
  }
}
