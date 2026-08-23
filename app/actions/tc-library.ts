'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireEditor() {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' as const }
  }
  return { email }
}

export type { FormPacket, ClauseRow } from '@/lib/data/tc/form-library-reads'

export async function saveFormPacket(name: string, formVersionIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  const n = name.trim()
  if (!n || !formVersionIds.length) return { ok: false, error: 'Name and at least one form.' }
  const { error } = await getServiceSupabase().from('tc_form_packets').insert({
    name: n,
    form_version_ids: formVersionIds,
    created_by: auth.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/forms')
  return { ok: true }
}

export async function saveClause(input: {
  scope: 'personal' | 'brokerage'
  category: string
  title: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!input.title.trim() || !input.body.trim()) return { ok: false, error: 'Title and body required.' }
  const { error } = await getServiceSupabase().from('tc_clauses').insert({
    scope: input.scope,
    category: input.category.trim() || 'General',
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: auth.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/forms')
  revalidatePath('/admin/signing')
  return { ok: true }
}
