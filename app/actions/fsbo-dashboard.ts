'use server'

/**
 * FSBO dashboard leftovers. /admin/fsbos redirects to Prospecting.
 * Build stays for any stale caller. Send actions refuse — Prospecting
 * is the only cold-outreach send.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCma } from '@/lib/cma/build'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { resolveWritableCmaSlot } from '@/lib/cma/versions'
import {
  retiredProspectingSendDataError,
  retiredProspectingSendError,
} from '@/lib/prospecting/retired-send'

async function requireAdmin(): Promise<boolean> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  return Boolean(role && role.role !== 'report_viewer')
}

type FsboRow = {
  fsbo_url: string
  street_address: string | null
  city: string | null
  postal_code: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
}

async function getFsboRow(fsboUrl: string): Promise<FsboRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('fsbo_listings')
    .select('fsbo_url, street_address, city, postal_code, owner_name, contact_phone, contact_email')
    .eq('fsbo_url', fsboUrl)
    .maybeSingle()
  return (data as FsboRow | null) ?? null
}

export async function buildFsboCmaAction(
  fsboUrl: string,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const f = await getFsboRow(fsboUrl)
    if (!f) return { data: null, error: 'FSBO listing not found' }
    if (!f.street_address) return { data: null, error: 'No street address on the FSBO record' }
    const slot = await resolveWritableCmaSlot(slugifyAddress(f.street_address))
    if (!slot.ok) return { data: null, error: slot.error }
    const slug = slot.slug
    const res = await buildCma({
      slug,
      rawAddress: f.street_address,
      city: f.city,
      postalCode: f.postal_code,
      client: {
        name: f.owner_name,
        email: f.contact_email,
        phone: f.contact_phone,
        notes: 'FSBO CMA (dashboard build)',
      },
      requestSource: 'fsbo-dashboard',
    })
    if (!res.ok) return { data: null, error: res.error ?? 'CMA build failed' }
    revalidatePath('/admin/fsbos')
    return { data: { slug }, error: null }
  } catch (err) {
    console.error('[buildFsboCmaAction]', err)
    return { data: null, error: 'CMA build failed unexpectedly' }
  }
}

export async function sendFsboCmaEmailAction(
  _fsboUrl: string,
  _opts: { acknowledgeReview?: boolean } = {},
): Promise<{ data: { transport: string } | null; error: string | null }> {
  return retiredProspectingSendDataError()
}

export type FsboSmsResult = { ok: true; sid: string } | { ok: false; error: string }

export async function sendFsboIntroSmsAction(_fsboUrl: string): Promise<FsboSmsResult> {
  return retiredProspectingSendError()
}
