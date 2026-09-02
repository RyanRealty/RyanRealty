'use server'

/**
 * Admin CMA actions — build, rebuild, approve, delete, and the two explicit
 * send paths (tracked Resend email + Gmail draft). Every action is gated on
 * an admin session and returns { data, error } / { error } — never throws.
 *
 * Sending ALWAYS requires an explicit button click on /admin/cmas/[slug].
 * Broker-to-self "text me this CMA" is also an explicit click and never
 * emails or texts the household. Nothing in this file is called from a cron.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildCma } from '@/lib/cma/build'
import { sendCmaToLead, prepareCmaSendPreview, type CmaSendOverride } from '@/lib/cma/send'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { slugifyAddress } from '@/lib/cma-request'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import { resolveWritableCmaSlot } from '@/lib/cma/versions'
import { applyCmaClientIntent, isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { parsePositiveInt, parsePositiveNumber, resolveCmaClientName } from '@/lib/cma/client-link'
import {
  attachCmaToPerson,
  getCmaAdminReviewRowBySlug,
  updateCmaRowFieldsBySlug,
  deleteCmaRowById,
} from '@/lib/data'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import { searchPeopleByName } from '@/lib/data/crm/searchPeople'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

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
  personId?: number | null
  beds?: number | string | null
  baths?: number | string | null
  sqft?: number | string | null
  intent?: string | null
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

    // Land the build on a writable slot: rebuild the open draft in place, or
    // open a new --vN document after a finalized/delivered CMA — never clobber
    // a protected document back to draft (lib/cma/versions.ts). In-place
    // rebuilds of a specific document stay on rebuildCmaAction (explicit slug).
    const slot = await resolveWritableCmaSlot(slug)
    if (!slot.ok) return { data: null, error: slot.error }
    slug = slot.slug

    const personId = parsePositiveInt(input.personId ?? null)
    const linked = personId ? await getPersonForCmaKickoff(personId) : null
    const intent = isCmaClientIntent(input.intent) ? input.intent : null
    const result = await buildCma({
      slug,
      mlsNumber: mls,
      rawAddress,
      client: {
        name: resolveCmaClientName({
          enteredName: input.clientName,
          linkedPersonName: linked?.name,
        }),
        email: input.clientEmail?.trim().toLowerCase() || linked?.primaryEmail || null,
        phone: input.clientPhone?.trim() || linked?.primaryPhone || null,
        notes: applyCmaClientIntent(null, intent),
      },
      brokerSlug: input.brokerSlug?.trim() || null,
      requestSource: 'admin-manual',
      personId,
      subjectFacts: {
        beds: parsePositiveInt(input.beds ?? null),
        baths: parsePositiveNumber(input.baths ?? null),
        sqft: parsePositiveInt(input.sqft ?? null),
      },
      clientIntent: intent,
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Build failed' }
    if (personId) {
      await attachCmaToPerson(slug, personId, { replace: true })
      revalidatePerson(personId)
    }
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
  personId?: number | null
  beds?: number | string | null
  baths?: number | string | null
  sqft?: number | string | null
  intent?: string | null
  priceOverride?: number | null
  brokerSlug?: string | null
}

/**
 * Re-render a CMA under a different signing broker WITHOUT recomputing numbers.
 *
 * This exists because the "Signing broker" select used to call rebuildCmaAction,
 * which re-selects comparables and re-runs two Anthropic passes — so changing
 * who signs a client-facing pricing document could change the recommended list
 * price. Swapping a signature block must never move a number (CLAUDE.md §0).
 */
export async function rebrandCmaAction(input: {
  slug: string
  brokerSlug: string
}): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const { rebrandCma } = await import('@/lib/cma/rebrand')
    const result = await rebrandCma({
      slug: input.slug.trim().toLowerCase(),
      brokerSlug: input.brokerSlug.trim(),
    })
    if (!result.ok) return { data: null, error: result.message }
    refresh(result.slug)
    return { data: { slug: result.slug }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Re-brand failed' }
  }
}

export async function rebuildCmaAction(
  input: RebuildCmaInput,
): Promise<{ data: { slug: string } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const slug = input.slug.trim().toLowerCase()
    const row = await getCmaAdminReviewRowBySlug(slug)
    if (!row) return { data: null, error: 'CMA not found' }

    const priceOverride =
      input.priceOverride != null && Number.isFinite(input.priceOverride) && input.priceOverride > 0
        ? Math.round(input.priceOverride)
        : null

    const personId =
      parsePositiveInt(input.personId ?? null) ??
      (row.person_id == null ? null : Number(row.person_id))
    const linked = personId ? await getPersonForCmaKickoff(personId) : null
    const intent = isCmaClientIntent(input.intent)
      ? input.intent
      : parseCmaClientIntent((row.client_notes as string | null) ?? null)

    const result = await buildCma({
      slug,
      mlsNumber: (row.subject_listing_key as string | null) ?? null,
      rawAddress: applySlugStreetDirectional(
        (row.subject_address as string | null) ?? '',
        slug,
      ) || null,
      city: (row.subject_city as string | null) ?? null,
      client: {
        name: resolveCmaClientName({
          enteredName: input.clientName,
          storedName: row.client_name as string | null,
          linkedPersonName: linked?.name,
        }),
        email:
          (input.clientEmail ?? (row.client_email as string | null))?.trim().toLowerCase() ||
          linked?.primaryEmail ||
          null,
        phone: (input.clientPhone ?? (row.client_phone as string | null))?.trim() || linked?.primaryPhone || null,
        notes: (row.client_notes as string | null) ?? null,
      },
      brokerSlug: input.brokerSlug?.trim() || (row.broker_slug as string | null),
      priceOverride,
      // Keep the ORIGINAL provenance: a rebuilt seller-lp request is still a
      // person who asked — stamping 'admin-rebuild' ejected rows from the
      // Asked-unsent send queue (found 2026-09-01).
      requestSource: (row.request_source as string | null) ?? 'admin-rebuild',
      personId,
      subjectFacts: {
        beds: parsePositiveInt(input.beds ?? (row.subject_beds as number | null)),
        baths: parsePositiveNumber(input.baths ?? (row.subject_baths as number | null)),
        sqft: parsePositiveInt(input.sqft ?? (row.subject_sqft as number | null)),
      },
      clientIntent: isCmaClientIntent(intent) ? intent : undefined,
      // Preserve the document type — a rebuild of an expired audit stays an audit.
      docType: (row.doc_type as string | null) === 'expired-audit' ? 'expired-audit' : 'cma',
    })
    if (!result.ok) return { data: null, error: result.error ?? 'Rebuild failed' }
    if (personId) {
      await attachCmaToPerson(slug, personId)
      revalidatePerson(personId)
    }
    // A rebuild returns the CMA to draft for a fresh review before any send.
    refresh(slug)
    return { data: { slug }, error: null }
  } catch (e) {
    console.error('[rebuildCmaAction]', e)
    return { data: null, error: 'Rebuild failed unexpectedly' }
  }
}

// ─── Approve / delete ────────────────────────────────────────────────────────

export async function approveCmaAction(
  slug: string,
  opts?: { acknowledgeReview?: boolean },
): Promise<{ error: string | null; needsReviewAck?: boolean }> {
  try {
    if (!(await requireAdmin())) return { error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const row = await getCmaAdminReviewRowBySlug(safeSlug)
    if (!row) return { error: 'CMA not found' }
    const htmlPath = String(row.html_path ?? '')
    if (!htmlPath.startsWith('db:cmas.html_content:') && !htmlPath.startsWith('public/cmas/')) {
      return { error: 'This CMA has no built document yet. Build it before approving.' }
    }
    // Accuracy gate (mirrors app/actions/bpo-admin.ts finalizeBpoAction): a
    // build flagged needs_review (unvetted comps, disputed audit, non-converged
    // methods) cannot approve silently — the broker must explicitly acknowledge
    // the recorded findings.
    const summary = row.build_summary as { needs_review?: boolean; review_reason?: string | null } | null
    if (summary?.needs_review && !opts?.acknowledgeReview) {
      return {
        error: `Flagged for broker review: ${summary.review_reason ?? 'accuracy findings recorded in the build summary'}`,
        needsReviewAck: true,
      }
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
    const row = await getCmaAdminReviewRowBySlug(safeSlug)
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
    const row = await getCmaAdminReviewRowBySlug(safeSlug)
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

/**
 * Sends the CMA to its client. `override` (subject/bodyText) carries the
 * broker's edited compose-dialog message (/admin/cmas worklist's
 * CmaSendDialog) straight through to lib/cma/send.ts sendCmaToLead, which
 * already supports it — omitted, the server composes the live default.
 * CmaReviewActions (/admin/cmas/[slug]) calls this with no second argument.
 */
export async function sendCmaToLeadAction(
  slug: string,
  override?: CmaSendOverride,
): Promise<{ data: { transport: 'gmail' | 'resend'; mailbox: string | null } | null; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const result = await sendCmaToLead(safeSlug, override)
    if (!result.ok) return { data: null, error: result.error ?? 'Send failed' }
    refresh(safeSlug)
    return {
      data: { transport: result.transport ?? 'resend', mailbox: result.mailbox ?? null },
      error: null,
    }
  } catch (e) {
    console.error('[sendCmaToLeadAction]', e)
    return { data: null, error: 'Send failed unexpectedly' }
  }
}

/**
 * Prepare the /admin/cmas worklist's send dialog: the default subject/body
 * (lib/cma/send.ts prepareCmaSendPreview, the same compose the server would
 * send if the broker doesn't edit anything) plus the already-sent state, so
 * the dialog can show "Already sent <date>" without a second round trip.
 */
export async function prepareCmaSendAction(slug: string): Promise<{
  data: {
    slug: string
    subjectAddress: string
    clientName: string | null
    clientEmail: string | null
    defaultSubject: string
    defaultBodyText: string
    docUrl: string
    alreadySent: { at: string } | null
  } | null
  error: string | null
}> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const safeSlug = slug.trim().toLowerCase()
    const preview = await prepareCmaSendPreview(safeSlug)
    if (!preview.ok) return { data: null, error: preview.error }
    const row = await getCmaAdminReviewRowBySlug(safeSlug)
    const deliveredAt = (row?.delivered_at as string | null) ?? null
    return {
      data: {
        slug: safeSlug,
        subjectAddress: preview.subjectAddress,
        clientName: preview.clientName,
        clientEmail: preview.clientEmail,
        defaultSubject: preview.subject,
        defaultBodyText: preview.bodyText,
        docUrl: preview.docUrl,
        alreadySent: deliveredAt ? { at: deliveredAt } : null,
      },
      error: null,
    }
  } catch (e) {
    console.error('[prepareCmaSendAction]', e)
    return { data: null, error: 'Could not prepare the send.' }
  }
}

export async function searchCmaPersonAction(
  query: string,
): Promise<{ data: Array<{ id: number; name: string | null; email: string | null }>; error: string | null }> {
  try {
    if (!(await requireAdmin())) return { data: [], error: 'Unauthorized' }
    const hits = await searchPeopleByName({ query, brokerScope: null, limit: 8 })
    return { data: hits, error: null }
  } catch (e) {
    console.error('[searchCmaPersonAction]', e)
    return { data: [], error: 'Search failed' }
  }
}

export async function attachCmaPersonAction(input: {
  slug: string
  personId: number
}): Promise<{
  data: { personId: number; clientName: string | null; clientEmail: string | null; clientPhone: string | null } | null
  error: string | null
}> {
  try {
    if (!(await requireAdmin())) return { data: null, error: 'Unauthorized' }
    const slug = input.slug.trim().toLowerCase()
    const personId = parsePositiveInt(input.personId)
    if (!slug || !personId) return { data: null, error: 'Pick a person to link.' }
    const result = await attachCmaToPerson(slug, personId, { replace: true })
    if (!result.ok) return { data: null, error: result.error }
    revalidatePerson(personId)
    refresh(slug)
    return {
      data: {
        personId: result.personId,
        clientName: result.clientName,
        clientEmail: result.clientEmail,
        clientPhone: result.clientPhone,
      },
      error: null,
    }
  } catch (e) {
    console.error('[attachCmaPersonAction]', e)
    return { data: null, error: 'Could not link this CMA to the person.' }
  }
}
