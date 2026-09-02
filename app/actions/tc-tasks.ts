'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

async function requireBroker(): Promise<{ email: string } | { error: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role) return { error: 'Not authorized' }
  return { email }
}

export async function setTcTaskStatus(
  taskId: string,
  status: 'open' | 'done' | 'cancelled',
  propertyKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }
  const now = new Date().toISOString()
  const { error } = await createServiceClient()
    .from('tc_tasks')
    .update({
      status,
      completed_at: status === 'done' ? now : null,
    })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/deals/${encodeURIComponent(propertyKey)}`)
  return { ok: true }
}
