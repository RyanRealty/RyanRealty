'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * Principal-broker document review queue + review record (OAR 863-015-0140).
 *
 * Oregon law requires the (managing) principal broker to review each document
 * of agreement within SEVEN BANKING DAYS of its acceptance/rejection/withdrawal,
 * and to keep "an electronic record of the review showing the name of the
 * reviewer and the date of the review." Items a broker submits (status
 * 'in_review') on LIVE deals land here, across all brokers, with the 7-banking-
 * day deadline surfaced. recordPrincipalReview writes the immutable named+dated
 * review record (tc_principal_reviews) and transitions the item.
 */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows narrow at mapping sites
type DbRow = Record<string, any>

export type { SignOffItem, SignOffDeal, SignOffQueue } from '@/lib/data/tc/getPrincipalSignOffQueue'
import { getPrincipalSignOffQueue as loadSignOffQueue } from '@/lib/data/tc/getPrincipalSignOffQueue'

export async function getPrincipalSignOffQueue() {
  return loadSignOffQueue()
}

// ---------------------------------------------------------------------------
// The review action — writes the OAR 863-015-0140 named + dated review record.
// ---------------------------------------------------------------------------

export type PrincipalReviewResult = { ok: boolean; error?: string }

/**
 * Record a principal-broker review of a checklist item (document of agreement)
 * and transition it. 'approved' → completed; 'sent_back' → required. Writes an
 * immutable tc_principal_reviews row (reviewer name + date) + a tc_events row.
 * Superuser (principal broker) only.
 */
export async function recordPrincipalReview(
  itemId: string,
  decision: 'approved' | 'sent_back',
  note?: string
): Promise<PrincipalReviewResult> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (role?.role !== 'superuser' || !email) return { ok: false, error: 'Principal broker only' }
  if (decision !== 'approved' && decision !== 'sent_back') return { ok: false, error: 'Invalid decision' }

  const supabase = getServiceSupabase()
  const { data: item } = await supabase
    .from('tc_checklist_items')
    .select('id, name, cycle_id, status, tc_cycles(deal_id)')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) return { ok: false, error: 'Item not found' }
  if ((item as DbRow).status !== 'in_review') return { ok: false, error: 'Item is not awaiting review' }

  const dealId = (item as DbRow).tc_cycles?.deal_id ?? null
  // The documents under this item at review time (the record's subject).
  const { data: assignments } = await supabase
    .from('tc_checklist_assignments')
    .select('document_id')
    .eq('item_id', itemId)
  const documentIds = (assignments ?? []).map((a: DbRow) => a.document_id)

  // reviewer name = the rule's "name of the reviewer"
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined
  const reviewerName = meta?.full_name || meta?.name || email
  const reviewedAt = new Date().toISOString()

  const { error: recErr } = await supabase.from('tc_principal_reviews').insert({
    deal_id: dealId,
    cycle_id: (item as DbRow).cycle_id,
    item_id: itemId,
    item_name: (item as DbRow).name,
    document_ids: documentIds,
    reviewer_email: email,
    reviewer_name: reviewerName,
    reviewed_at: reviewedAt,
    decision,
    note: note?.trim() || null,
  })
  if (recErr) return { ok: false, error: recErr.message }

  const newStatus = decision === 'approved' ? 'completed' : 'required'
  const { error: upErr } = await supabase
    .from('tc_checklist_items')
    .update({ status: newStatus })
    .eq('id', itemId)
  if (upErr) return { ok: false, error: upErr.message }

  await supabase.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: (item as DbRow).cycle_id,
    actor: email,
    action: 'principal_broker_review',
    detail: {
      item: (item as DbRow).name,
      decision,
      reviewer: reviewerName,
      reviewed_at: reviewedAt,
      rule: 'OAR 863-015-0140',
      note: note?.trim() || null,
    },
  })

  revalidatePath('/admin/sign-off')
  revalidatePath('/admin/deals')

  const { data: deal } = dealId
    ? await supabase.from('tc_deals').select('address, broker_name, property_key').eq('id', dealId).maybeSingle()
    : { data: null }
  const { brokerEmailFromFileName } = await import('@/lib/tc/deal-scope')
  const { notifyDealMailbox } = await import('@/lib/tc/deal-notify')
  const to = brokerEmailFromFileName((deal as { broker_name?: string | null } | null)?.broker_name)
  const address = (deal as { address?: string } | null)?.address ?? 'your deal'
  const key = (deal as { property_key?: string } | null)?.property_key
  await notifyDealMailbox({
    to,
    subject:
      decision === 'approved'
        ? `Signed off: ${(item as DbRow).name} on ${address}`
        : `Sent back: ${(item as DbRow).name} on ${address}`,
    bodyText:
      decision === 'approved'
        ? `Matt signed off on “${(item as DbRow).name}” for ${address}.${key ? `\n\nOpen deal: https://ryan-realty.com/admin/deals/${encodeURIComponent(key)}` : ''}`
        : `Matt sent “${(item as DbRow).name}” back on ${address}.${note?.trim() ? `\n\nNote: ${note.trim()}` : ''}${key ? `\n\nOpen deal: https://ryan-realty.com/admin/deals/${encodeURIComponent(key)}` : ''}`,
  })
  return { ok: true }
}
