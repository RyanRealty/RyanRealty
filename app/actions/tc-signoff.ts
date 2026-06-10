'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * Principal-broker sign-off queue. As the principal broker, Matt must review
 * and sign off on every transaction's documents as they complete (his OAR
 * 863-015 supervisory duty). Items a broker has submitted (status 'in_review')
 * on LIVE-pipeline deals land here, across all brokers' deals, in one place.
 * Sign-off (→ completed) / send-back (→ required) reuse setTcChecklistStatus.
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
}

export async function getPrincipalSignOffQueue(): Promise<SignOffQueue> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  // The principal's queue — superuser only.
  if (role?.role !== 'superuser') return { authorized: false, deals: [], totalItems: 0 }

  const supabase = getServiceSupabase()

  const { data: deals } = await supabase
    .from('tc_deals')
    .select('id, property_key, address, broker_name, stage')
    .in('stage', LIVE_STAGES)
  if (!deals?.length) return { authorized: true, deals: [], totalItems: 0 }

  const dealById = new Map((deals as DbRow[]).map((d) => [d.id, d]))
  const { data: cycles } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, kind')
    .in('deal_id', Array.from(dealById.keys()))
  const cycleById = new Map((cycles ?? []).map((c: DbRow) => [c.id, c]))
  const cycleIds = (cycles ?? []).map((c: DbRow) => c.id)
  if (!cycleIds.length) return { authorized: true, deals: [], totalItems: 0 }

  const { data: items } = await supabase
    .from('tc_checklist_items')
    .select('id, cycle_id, name, sort_order')
    .in('cycle_id', cycleIds)
    .eq('status', 'in_review')
    .order('sort_order', { ascending: true })
  if (!items?.length) return { authorized: true, deals: [], totalItems: 0 }

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
    })
  }

  const dealsOut = Array.from(byDeal.values()).sort((a, b) => a.address.localeCompare(b.address))
  return {
    authorized: true,
    deals: dealsOut,
    totalItems: dealsOut.reduce((s, d) => s + d.items.length, 0),
  }
}
