/**
 * getCrmAccess — slim CRM identity for admin chrome and capability checks.
 *
 * Lives in the DAL so the (protected) layout / require-admin / console palette
 * can resolve role + own-broker slug WITHOUT importing app/actions/crm.ts.
 * That god-file is a 'use server' module: a single named import pulls every
 * static dependency (MMS, Meta CAPI, people-query compiler, …) into the
 * serverless function for every admin page, including
 * /admin/analytics/action-required (Vercel 250 MB uncompressed cap).
 *
 * Request-memoized with React cache() — hot admin pages call this 3–5 times
 * per render. Same email-lowercase + role + slug contract as the previous
 * implementation in app/actions/crm.ts.
 */
import 'server-only'

import { cache } from 'react'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { resolveCrmSlugForAccess } from '@/lib/data/brokers/resolveCrmSlug'

export type CrmAccess = {
  email: string
  role: 'superuser' | 'broker' | 'report_viewer'
  /** Own CRM slug from brokers.crm_slug (table-first). */
  brokerSlug: string | null
}

const resolveCrmAccess = cache(async (): Promise<CrmAccess | null> => {
  const session = await getSession()
  const email = session?.user?.email?.trim().toLowerCase() ?? null
  const role = await getAdminRoleForEmail(email)
  if (!role || !email) return null
  return {
    email,
    role: role.role,
    brokerSlug: await resolveCrmSlugForAccess({ email, brokerId: role.brokerId }),
  }
})

/** Resolve the caller's CRM access (role + own-broker slug). Null when not an admin. */
export async function getCrmAccess(): Promise<CrmAccess | null> {
  return resolveCrmAccess()
}
