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
import { getDealScopeRow, getMailMessagesForAction } from '@/lib/data/tc/mail-reads'

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

/** Not transaction mail after all. Kept on the index as dismissed, never deleted. */
export async function dismissQueuedMail(input: { messageIds: string[]; reason?: string }): Promise<Result> {
  const auth = await ctxForEdit()
  if ('error' in auth) return { ok: false, error: auth.error ?? 'Not authorized' }
  const ids = [...new Set(input.messageIds)].slice(0, 200)
  const loaded = await loadMessages(ids, auth.ownMailbox)
  if ('error' in loaded) return { ok: false, error: loaded.error ?? 'Not found' }
  const { error } = await createServiceClient()
    .from('tc_mail_messages')
    .update({
      status: 'dismissed',
      decided_by: auth.ctx.email,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
  if (error) return { ok: false, error: 'Could not update those emails.' }
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
