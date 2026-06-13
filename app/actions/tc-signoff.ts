'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { reviewDeadline, type ReviewDeadline } from '@/lib/tc/banking-days'

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

const LIVE_STAGES = ['pending', 'pre_contract', 'active_listing']

export type SignOffItem = {
  itemId: string
  name: string
  docs: Array<{ id: string; name: string; thumbUrl: string | null }>
  /** OAR 863-015-0140 7-banking-day deadline (from the cycle's acceptance date). */
  deadline: ReviewDeadline | null
}

export type SignOffDeal = {
  propertyKey: string
  address: string
  broker: string | null
  stage: string
  cycleKind: string
  items: SignOffItem[]
}

export type SignOffQueue = {
  authorized: boolean
  deals: SignOffDeal[]
  totalItems: number
  overdueItems: number
}

export async function getPrincipalSignOffQueue(): Promise<SignOffQueue> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  // The principal's queue — superuser only.
  if (role?.role !== 'superuser') return { authorized: false, deals: [], totalItems: 0, overdueItems: 0 }

  const supabase = getServiceSupabase()
  const now = new Date()

  const { data: deals } = await supabase
    .from('tc_deals')
    .select('id, property_key, address, broker_name, stage')
    .in('stage', LIVE_STAGES)
  if (!deals?.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const dealById = new Map((deals as DbRow[]).map((d) => [d.id, d]))
  const { data: cycles } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, kind, contract_acceptance_date')
    .in('deal_id', Array.from(dealById.keys()))
  const cycleById = new Map((cycles ?? []).map((c: DbRow) => [c.id, c]))
  const cycleIds = (cycles ?? []).map((c: DbRow) => c.id)
  if (!cycleIds.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const { data: items } = await supabase
    .from('tc_checklist_items')
    .select('id, cycle_id, name, sort_order')
    .in('cycle_id', cycleIds)
    .eq('status', 'in_review')
    .order('sort_order', { ascending: true })
  if (!items?.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const itemIds = (items as DbRow[]).map((i) => i.id)
  const { data: assignments } = await supabase
    .from('tc_checklist_assignments')
    .select('item_id, document_id')
    .in('item_id', itemIds)
  const docIds = Array.from(new Set((assignments ?? []).map((a: DbRow) => a.document_id)))
  const { data: docs } = docIds.length
    ? await supabase.from('tc_documents').select('id, name').in('id', docIds)
    : { data: [] as DbRow[] }
  const docById = new Map((docs ?? []).map((d: DbRow) => [d.id, d]))

  // batched signed thumbnails for preview
  const thumbPaths = docIds.map((id) => `tc-thumbs/${id}__plast.jpg`)
  const thumbByPath = new Map<string, string>()
  if (thumbPaths.length) {
    const { data: signed } = await supabase.storage.from('tc-documents').createSignedUrls(thumbPaths, 600)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) thumbByPath.set(s.path ?? '', s.signedUrl)
  }

  const docsByItem = new Map<string, Array<{ id: string; name: string; thumbUrl: string | null }>>()
  for (const a of (assignments ?? []) as DbRow[]) {
    const d = docById.get(a.document_id)
    if (!d) continue
    const arr = docsByItem.get(a.item_id) ?? []
    arr.push({ id: d.id, name: d.name, thumbUrl: thumbByPath.get(`tc-thumbs/${d.id}__plast.jpg`) ?? null })
    docsByItem.set(a.item_id, arr)
  }

  const byDeal = new Map<string, SignOffDeal>()
  for (const it of items as DbRow[]) {
    const cyc = cycleById.get(it.cycle_id)
    if (!cyc) continue
    const deal = dealById.get(cyc.deal_id)
    if (!deal) continue
    const key = deal.property_key
    if (!byDeal.has(key)) {
      byDeal.set(key, {
        propertyKey: deal.property_key,
        address: deal.address,
        broker: deal.broker_name,
        stage: deal.stage,
        cycleKind: cyc.kind,
        items: [],
      })
    }
    byDeal.get(key)!.items.push({
      itemId: it.id,
      name: it.name,
      docs: docsByItem.get(it.id) ?? [],
      // OAR 863-015-0140: 7 banking days from the agreement's acceptance date.
      deadline: reviewDeadline(cyc.contract_acceptance_date ?? null, now),
    })
  }

  const dealsOut = Array.from(byDeal.values())
    .map((d) => ({
      ...d,
      // soonest deadline (most overdue) first within each deal
      items: d.items.sort(
        (a, b) => (a.deadline?.bankingDaysRemaining ?? 9999) - (b.deadline?.bankingDaysRemaining ?? 9999)
      ),
    }))
    .sort((a, b) => {
      const am = Math.min(...a.items.map((i) => i.deadline?.bankingDaysRemaining ?? 9999))
      const bm = Math.min(...b.items.map((i) => i.deadline?.bankingDaysRemaining ?? 9999))
      return am - bm
    })
  const totalItems = dealsOut.reduce((s, d) => s + d.items.length, 0)
  const overdueItems = dealsOut.reduce(
    (s, d) => s + d.items.filter((i) => i.deadline?.overdue).length,
    0
  )
  return { authorized: true, deals: dealsOut, totalItems, overdueItems }
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
  return { ok: true }
}
