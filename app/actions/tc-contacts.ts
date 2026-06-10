'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { TC_CONTACT_ROLES, type TcContact } from '@/lib/tc/contact-roles'

/**
 * Deal team & contacts (tc-builder rung 15). A deal's co-agents + every party
 * (lender, appraiser, title, escrow, TC, home warranty, other-side agent),
 * backfilled from tc_cycles.raw and editable. Feeds notifications, signing
 * recipients, and the calendar. Every mutation writes a tc_events row.
 * Roles/labels/types live in lib/tc/contact-roles.ts (a 'use server' file may
 * only export async functions).
 */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function authorize() {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { ok: false as const, actor: null }
  }
  return { ok: true as const, actor: session?.user?.email ?? 'admin' }
}

export async function getDealContacts(dealId: string): Promise<TcContact[]> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('tc_deal_contacts')
    .select('id, role, name, company, email, phone, alternate_phone, notes, source')
    .eq('deal_id', dealId)
    .order('role', { ascending: true })
  const order = (r: string) => {
    const i = (TC_CONTACT_ROLES as readonly string[]).indexOf(r)
    return i < 0 ? 99 : i
  }
  return ((data ?? []) as TcContact[]).sort((a, b) => order(a.role) - order(b.role) || (a.name ?? '').localeCompare(b.name ?? ''))
}

export type SaveContactInput = {
  id?: string
  dealId: string
  role: string
  name?: string
  company?: string
  email?: string
  phone?: string
  notes?: string
}

export async function saveDealContact(input: SaveContactInput): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize()
  if (!auth.ok) return { ok: false, error: 'Not authorized' }
  if (!(TC_CONTACT_ROLES as readonly string[]).includes(input.role)) return { ok: false, error: 'Invalid role' }
  if (!input.name?.trim() && !input.company?.trim() && !input.email?.trim()) {
    return { ok: false, error: 'Add at least a name, company, or email' }
  }
  const supabase = getServiceSupabase()
  const row = {
    deal_id: input.dealId,
    role: input.role,
    name: input.name?.trim() || null,
    company: input.company?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    source: 'manual',
    updated_at: new Date().toISOString(),
  }
  let action = 'contact_added'
  if (input.id) {
    const { error } = await supabase.from('tc_deal_contacts').update(row).eq('id', input.id)
    if (error) return { ok: false, error: error.message }
    action = 'contact_updated'
  } else {
    const { error } = await supabase.from('tc_deal_contacts').insert(row)
    if (error) return { ok: false, error: error.message }
  }
  await supabase.from('tc_events').insert({
    deal_id: input.dealId,
    actor: auth.actor,
    action,
    detail: { role: input.role, name: row.name, company: row.company, email: row.email },
  })
  revalidatePath('/admin/deals')
  return { ok: true }
}

export async function deleteDealContact(contactId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await authorize()
  if (!auth.ok) return { ok: false, error: 'Not authorized' }
  const supabase = getServiceSupabase()
  const { data: c } = await supabase
    .from('tc_deal_contacts')
    .select('id, deal_id, role, name')
    .eq('id', contactId)
    .maybeSingle()
  if (!c) return { ok: false, error: 'Contact not found' }
  const { error } = await supabase.from('tc_deal_contacts').delete().eq('id', contactId)
  if (error) return { ok: false, error: error.message }
  await supabase.from('tc_events').insert({
    deal_id: c.deal_id,
    actor: auth.actor,
    action: 'contact_removed',
    detail: { role: c.role, name: c.name },
  })
  revalidatePath('/admin/deals')
  return { ok: true }
}
