'use server'

/**
 * Isolated CMA rebuild door. /admin/valuations retries a failed build from
 * here so the page never imports the CMA send module / puppeteer
 * (ci:pdf-trace-guard). The review page still re-exports this from cma-admin.ts.
 */

import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { buildCma } from '@/lib/cma/build'
import { applySlugStreetDirectional } from '@/lib/cma/address-slug'
import { isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { parsePositiveInt, parsePositiveNumber, resolveCmaClientName } from '@/lib/cma/client-link'
import { attachCmaToPerson, getCmaAdminReviewRowBySlug } from '@/lib/data'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

async function requireAdmin(): Promise<string | null> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || role.role === 'report_viewer') return null
  return session?.user?.email ?? 'admin'
}

function refresh(slug?: string) {
  revalidatePath('/admin/cmas')
  revalidatePath('/admin/valuations')
  if (slug) revalidatePath(`/admin/cmas/${slug}`)
}

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
      rawAddress:
        applySlugStreetDirectional((row.subject_address as string | null) ?? '', slug) || null,
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
        phone:
          (input.clientPhone ?? (row.client_phone as string | null))?.trim() ||
          linked?.primaryPhone ||
          null,
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
