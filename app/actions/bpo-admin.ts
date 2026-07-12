'use server'

/**
 * Admin Broker Price Opinion actions — build, rebuild (with an opinion-of-value
 * override), finalize, and delete. Every action is gated on an admin session
 * and returns { data, error } / { error } — never throws. A BPO is broker-facing
 * and internal: there is no auto-send path here.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildBpo } from '@/lib/bpo/build'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { slugifyBpoAddress } from '@/lib/bpo/slug'
import { getBpoAdminRowBySlug, updateBpoRowFieldsBySlug, deleteBpoRowById } from '@/lib/data/bpo/reads'

async function requireAdmin(): Promise<string | null> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || role.role === 'report_viewer') return null
  return session?.user?.email ?? 'admin'
}

function refresh(slug?: string) {
  revalidatePath('/admin/bpo')
  if (slug) revalidatePath(`/admin/bpo/${slug}`)
}

// ─── Build (manual form) ─────────────────────────────────────────────────────

export type BuildBpoAdminInput = {
  address?: string | null
  mlsNumber?: string | null
  brokerSlug?: string | null
  purpose?: string | null
}

export async function buildBpoAdminAction(
  input: BuildBpoAdminInput,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    const email = await requireAdmin()
    if (!email) return { data: null, error: 'Unauthorized' }
    const address = input.address?.trim() || null
    const mls = input.mlsNumber?.trim() || null
    if (!address && !mls) return { data: null, error: 'Enter a property address or an MLS number.' }

    let slug: string
    let rawAddress = address
    if (address) {
      slug = slugifyBpoAddress(address)
    } else {
      const resolved = await resolveCmaSubject({ mlsNumber: mls })
      if (!resolved.subject) return { data: null, error: `No listing found for MLS ${mls}.` }
      rawAddress = `${resolved.subject.streetAddress}, ${resolved.subject.city}, ${resolved.subject.state} ${resolved.subject.postalCode ?? ''}`.trim()
      slug = slugifyBpoAddress(rawAddress)
    }

    const result = await buildBpo({
      slug,
      mlsNumber: mls,
      rawAddress,
      brokerSlug: input.brokerSlug?.trim() || null,
      purpose: input.purpose?.trim() || null,
      requestedBy: email,
      requestSource: 'admin-manual',
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Build failed' }
    refresh(slug)
    return { data: { slug }, error: null }
  } catch (e) {
    console.error('[buildBpoAdminAction]', e)
    return { data: null, error: 'Build failed unexpectedly' }
  }
}

// ─── Rebuild (review page: opinion-of-value override + purpose) ──────────────

export type RebuildBpoInput = {
  slug: string
  priceOverride?: number | null
  brokerSlug?: string | null
  purpose?: string | null
}

export async function rebuildBpoAction(
  input: RebuildBpoInput,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    const email = await requireAdmin()
    if (!email) return { data: null, error: 'Unauthorized' }
    const slug = input.slug.trim().toLowerCase()
    const row = await getBpoAdminRowBySlug(slug)
    if (!row) return { data: null, error: 'Broker price opinion not found' }

    const priceOverride =
      input.priceOverride != null && Number.isFinite(input.priceOverride) && input.priceOverride > 0
        ? Math.round(input.priceOverride)
        : null

    const result = await buildBpo({
      slug,
      mlsNumber: (row.subject_listing_key as string | null) ?? null,
      rawAddress: (row.subject_address as string | null) ?? null,
      city: (row.subject_city as string | null) ?? null,
      brokerSlug: input.brokerSlug?.trim() || (row.broker_slug as string | null),
      purpose: input.purpose?.trim() || (row.purpose as string | null),
      priceOverride,
      requestedBy: email,
      requestSource: 'admin-rebuild',
      client: {
        personId: (row.person_id as number | null) ?? null,
        clientName: null,
        clientEmail: null,
      },
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Rebuild failed' }
    refresh(slug)
    return { data: { slug }, error: null }
  } catch (e) {
    console.error('[rebuildBpoAction]', e)
    return { data: null, error: 'Rebuild failed unexpectedly' }
  }
}

// ─── Finalize / delete ───────────────────────────────────────────────────────

export async function finalizeBpoAction(
  slug: string,
  opts?: { acknowledgeReview?: boolean },
): Promise<{ error: string | null; needsReviewAck?: boolean }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const row = await getBpoAdminRowBySlug(safeSlug)
    if (!row) return { error: 'Broker price opinion not found' }
    if (!row.html_content) return { error: 'This opinion has no built document yet. Build it before finalizing.' }
    // Accuracy gate (Matt directive 2026-07-11): a build flagged needs_review
    // (unvetted comps, disputed audit, non-converged methods) cannot finalize
    // silently — the broker must explicitly acknowledge the recorded findings.
    const summary = row.build_summary as { needs_review?: boolean; review_reason?: string | null } | null
    if (summary?.needs_review && !opts?.acknowledgeReview) {
      return {
        error: `Flagged for broker review: ${summary.review_reason ?? 'accuracy findings recorded in the build summary'}`,
        needsReviewAck: true,
      }
    }
    const res = await updateBpoRowFieldsBySlug(safeSlug, {
      status: 'final',
      finalized_at: new Date().toISOString(),
    })
    if (!res.ok) return { error: res.error ?? 'Finalize failed' }
    refresh(safeSlug)
    return { error: null }
  } catch (e) {
    console.error('[finalizeBpoAction]', e)
    return { error: 'Finalize failed unexpectedly' }
  }
}

export async function deleteBpoAction(id: string): Promise<{ error: string | null }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    if (!id.trim()) return { error: 'Missing id' }
    const res = await deleteBpoRowById(id.trim())
    if (!res.ok) return { error: res.error ?? 'Delete failed' }
    refresh()
    return { error: null }
  } catch (e) {
    console.error('[deleteBpoAction]', e)
    return { error: 'Delete failed unexpectedly' }
  }
}
