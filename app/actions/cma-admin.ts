'use server'

/**
 * Admin CMA actions — build, rebuild, approve, delete, and the two explicit
 * send paths (tracked Resend email + Gmail draft). Every action is gated on
 * an admin session and returns { data, error } / { error } — never throws.
 *
 * Sending ALWAYS requires an explicit button click on /admin/cmas/[slug].
 * Nothing in this file is called from a cron.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildCma } from '@/lib/cma/build'
import { sendCmaToLead } from '@/lib/cma/send'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { slugifyAddress } from '@/lib/cma-request'
import {
  getCmaAdminRowBySlug,
  updateCmaRowFieldsBySlug,
  deleteCmaRowById,
} from '@/lib/data'

async function requireAdmin(): Promise<string | null> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || role.role === 'report_viewer') return null
  return session?.user?.email ?? 'admin'
}

function refresh(slug?: string) {
  revalidatePath('/admin/cmas')
  if (slug) revalidatePath(`/admin/cmas/${slug}`)
}

// ─── Build (manual form) ─────────────────────────────────────────────────────

export type BuildCmaAdminInput = {
  address?: string | null
  mlsNumber?: string | null
  clientName?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  brokerSlug?: string | null
}

export async function buildCmaAdminAction(
  input: BuildCmaAdminInput,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const address = input.address?.trim() || null
    const mls = input.mlsNumber?.trim() || null
    if (!address && !mls) {
      return { data: null, error: 'Enter a property address or an MLS number.' }
    }

    // Canonical slug: derived once from the subject address (G47 one property,
    // one slug). MLS-only builds resolve the subject first to get the address.
    let slug: string
    let rawAddress = address
    if (address) {
      slug = slugifyAddress(address)
    } else {
      const resolved = await resolveCmaSubject({ mlsNumber: mls })
      if (!resolved.subject) {
        return { data: null, error: `No listing found for MLS ${mls}.` }
      }
      rawAddress = `${resolved.subject.streetAddress}, ${resolved.subject.city}, OR ${resolved.subject.postalCode ?? ''}`.trim()
      slug = slugifyAddress(rawAddress)
    }

    const result = await buildCma({
      slug,
      mlsNumber: mls,
      rawAddress,
      client: {
        name: input.clientName?.trim() || null,
        email: input.clientEmail?.trim().toLowerCase() || null,
        phone: input.clientPhone?.trim() || null,
        notes: null,
      },
      brokerSlug: input.brokerSlug?.trim() || null,
      requestSource: 'admin-manual',
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Build failed' }
    refresh(slug)
    return { data: { slug }, error: null }
  } catch (e) {
    console.error('[buildCmaAdminAction]', e)
    return { data: null, error: 'Build failed unexpectedly' }
  }
}

// ─── Rebuild (review page: client info + price adjustment) ──────────────────

export type RebuildCmaInput = {
  slug: string
  clientName?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  priceOverride?: number | null
  brokerSlug?: string | null
}

export async function rebuildCmaAction(
  input: RebuildCmaInput,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const slug = input.slug.trim().toLowerCase()
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'CMA not found' }

    const priceOverride =
      input.priceOverride != null && Number.isFinite(input.priceOverride) && input.priceOverride > 0
        ? Math.round(input.priceOverride)
        : null

    const result = await buildCma({
      slug,
      mlsNumber: (row.subject_listing_key as string | null) ?? null,
      rawAddress: (row.subject_address as string | null) ?? null,
      city: (row.subject_city as string | null) ?? null,
      client: {
        name: (input.clientName ?? (row.client_name as string | null))?.trim() || null,
        email: (input.clientEmail ?? (row.client_email as string | null))?.trim().toLowerCase() || null,
        phone: (input.clientPhone ?? (row.client_phone as string | null))?.trim() || null,
        notes: (row.client_notes as string | null) ?? null,
      },
      brokerSlug: input.brokerSlug?.trim() || (row.broker_slug as string | null),
      priceOverride,
      requestSource: 'admin-rebuild',
      // Preserve the document type — a rebuild of an expired audit stays an audit.
      docType: (row.doc_type as string | null) === 'expired-audit' ? 'expired-audit' : 'cma',
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Rebuild failed' }
    // A rebuild returns the CMA to draft for a fresh review before any send.
    refresh(slug)
    return { data: { slug }, error: null }
  } catch (e) {
    console.error('[rebuildCmaAction]', e)
    return { data: null, error: 'Rebuild failed unexpectedly' }
  }
}

// ─── Approve / delete ────────────────────────────────────────────────────────

export async function approveCmaAction(slug: string): Promise<{ error: string | null }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const row = await getCmaAdminRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }
    if (!row.html_content && !(row.html_path as string | null)?.startsWith('public/cmas/')) {
      return { error: 'This CMA has no built document yet. Build it before approving.' }
    }
    const res = await updateCmaRowFieldsBySlug(safeSlug, {
      status: 'finalized',
      finalized_at: new Date().toISOString(),
    })
    if (!res.ok) return { error: res.error ?? 'Approve failed' }
    refresh(safeSlug)
    return { error: null }
  } catch (e) {
    console.error('[approveCmaAction]', e)
    return { error: 'Approve failed unexpectedly' }
  }
}

/**
 * Archive — reversible shelving. The CMA disappears from the working list and
 * every send surface (getContactCmas / the Send Center filter on archived_at)
 * but keeps its document, pricing, and comp set. Unarchive restores it.
 */
export async function archiveCmaAction(slug: string): Promise<{ error: string | null }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const row = await getCmaAdminRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }
    // status 'archived' drives the /admin/cmas facet; archived_at is the flag
    // the per-contact reads (getContactCmas) filter on. Set both together.
    const res = await updateCmaRowFieldsBySlug(safeSlug, {
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    if (!res.ok) return { error: res.error ?? 'Archive failed' }
    refresh(safeSlug)
    return { error: null }
  } catch (e) {
    console.error('[archiveCmaAction]', e)
    return { error: 'Archive failed unexpectedly' }
  }
}

export async function unarchiveCmaAction(slug: string): Promise<{ error: string | null }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const row = await getCmaAdminRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }
    // Restore the pre-archive status from the row's own lifecycle timestamps.
    const status = row.delivered_at ? 'delivered' : row.finalized_at ? 'finalized' : 'draft'
    const res = await updateCmaRowFieldsBySlug(safeSlug, { status, archived_at: null })
    if (!res.ok) return { error: res.error ?? 'Unarchive failed' }
    refresh(safeSlug)
    return { error: null }
  } catch (e) {
    console.error('[unarchiveCmaAction]', e)
    return { error: 'Unarchive failed unexpectedly' }
  }
}

export async function deleteCmaAction(id: string): Promise<{ error: string | null }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    if (!id.trim()) return { error: 'Missing CMA id' }
    const res = await deleteCmaRowById(id.trim())
    if (!res.ok) return { error: res.error ?? 'Delete failed' }
    refresh()
    return { error: null }
  } catch (e) {
    console.error('[deleteCmaAction]', e)
    return { error: 'Delete failed unexpectedly' }
  }
}

// ─── Send path (explicit click only) ─────────────────────────────────────────

export async function sendCmaToLeadAction(
  slug: string,
): Promise<{ data: { transport: 'gmail' | 'resend'; mailbox: string | null } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const result = await sendCmaToLead(slug.trim().toLowerCase())
    if (!result.ok) return { data: null, error: result.error ?? 'Send failed' }
    refresh(slug.trim().toLowerCase())
    return {
      data: { transport: result.transport ?? 'resend', mailbox: result.mailbox ?? null },
      error: null,
    }
  } catch (e) {
    console.error('[sendCmaToLeadAction]', e)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}
