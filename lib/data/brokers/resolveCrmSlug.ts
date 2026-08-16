import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { pickCrmSlug } from '@/lib/crm/resolve-broker-slug'

/**
 * Resolve the signed-in admin's CRM slug from public.brokers.
 *
 * admin_roles.broker_id → brokers.crm_slug is the onboard-without-a-deploy
 * path. Email match is the fallback. The hardcoded mailbox map is last.
 */
export async function resolveCrmSlugForAccess(input: {
  email: string
  brokerId: string | null
}): Promise<string | null> {
  const email = input.email.trim().toLowerCase()
  const sb = createServiceClient()

  let slugFromBrokerId: string | null = null
  if (input.brokerId) {
    const { data } = await sb
      .from('brokers')
      .select('crm_slug')
      .eq('id', input.brokerId)
      .maybeSingle()
    slugFromBrokerId = (data?.crm_slug as string | null) ?? null
  }

  let slugFromEmailRow: string | null = null
  if (email) {
    const { data } = await sb
      .from('brokers')
      .select('crm_slug')
      .eq('email', email)
      .maybeSingle()
    slugFromEmailRow = (data?.crm_slug as string | null) ?? null
  }

  return pickCrmSlug({ email, slugFromBrokerId, slugFromEmailRow })
}
