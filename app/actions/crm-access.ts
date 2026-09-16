'use server'

/**
 * Thin CRM access resolver for admin shell / layout.
 *
 * Kept out of app/actions/crm.ts on purpose: that file statically (and via
 * NFT-followed dynamic imports) pulls sendGovernedEmail → gmail →
 * email-signature → the entire @/lib/data barrel, plus TC PDF/pdfjs. Importing
 * getCrmAccess from crm.ts into app/admin/(protected)/layout.tsx made
 * /admin/analytics/action-required a ~806mb serverless function and blocked
 * every production deploy after the public/proof symlink fix.
 */

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

// Request-memoized: hot admin pages call getCrmAccess several times per render.
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

export async function requireCrmAccess(): Promise<
  { ok: true; access: CrmAccess } | { ok: false; error: string }
> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  return { ok: true, access }
}
