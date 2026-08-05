import 'server-only'

/**
 * The ONE "built" definition for a prospect's document (spec 07 §4.1).
 *
 * Both the worklist pill and the send-guard (app/actions, not built here) call
 * `getBuiltDocForProspect` — they can no longer disagree about what "built"
 * means. Resolves the `cmas` row by `prospect.cma_id` FIRST (an indexed point
 * lookup, spec §4.2); only when `cma_id` is null does it fall back to the
 * address-slug join, and that fallback is logged so drift is visible.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { slugifyAddress, pickLatestCmaVersion } from '@/lib/cma/address-slug'
import { findOpenCmaActionBySlug } from '@/lib/data/cma/queue'
import { acceptedDocTypesFor, expectedDocTypeFor, mergeChannelSentState, type ProspectDocState, type ProspectKind } from './types'

export { expectedDocTypeFor, introTemplateKeyFor } from './types'

/** The subset of an expired_listings/fsbo_listings row getBuiltDocForProspect needs. */
export interface ProspectDocInput {
  /** listing_key (expired) | fsbo_url (fsbo) — used only for the fallback console.warn. */
  id: string
  cma_id: string | null
  street_address: string | null
  outreach_sms_sent_at: string | null
  outreach_sms_sid: string | null
  /** Optional — the email-channel stamp (migration 20260722010100). Callers
   *  reading a pre-migration row simply omit it (channel-aware sent-state
   *  degrades to SMS-only). */
  outreach_email_sent_at?: string | null
}

type CmaJoinRow = {
  id: string
  slug: string
  doc_type: string | null
  status: string | null
  html_path: string | null
  recommended_list: number | null
}

const CMA_JOIN_COLUMNS = 'id, slug, doc_type, status, html_path, recommended_list'

async function resolveCmaRow(
  sb: ReturnType<typeof createServiceClient>,
  prospect: ProspectDocInput,
): Promise<CmaJoinRow | null> {
  if (prospect.cma_id) {
    const { data, error } = await sb
      .from('cmas')
      .select(CMA_JOIN_COLUMNS)
      .eq('id', prospect.cma_id)
      .maybeSingle()
    if (error) {
      console.error('[prospecting] cma_id lookup failed for', prospect.id, error.message)
      return null
    }
    if (data) return data as CmaJoinRow
    // A dangling cma_id (row deleted) — do not silently fall back to a fuzzy
    // slug join; that would defeat the point of the FK. Needs a rebuild.
    console.error('[prospecting] cma_id set but row not found for', prospect.id, prospect.cma_id)
    return null
  }
  if (!prospect.street_address) return null
  const slug = slugifyAddress(prospect.street_address)
  console.warn('[prospecting] cma_id missing, slug fallback for', prospect.id)
  const { data, error } = await sb
    .from('cmas')
    .select(CMA_JOIN_COLUMNS)
    .or(`slug.eq.${slug},slug.like.${slug}--v*`)
  if (error) {
    console.error('[prospecting] slug fallback lookup failed for', prospect.id, error.message)
    return null
  }
  return pickLatestCmaVersion((data ?? []) as CmaJoinRow[], slug)
}

function isSendableStatus(status: string | null): boolean {
  return status === 'draft' || status === 'finalized'
}

/** Most recent killed content:cma action for this address slug, if any. */
async function findKilledCmaActionBySlug(
  sb: ReturnType<typeof createServiceClient>,
  slug: string,
): Promise<{ id: string; killed_reason: string | null } | null> {
  const { data, error } = await sb
    .from('marketing_brain_actions')
    .select('id, killed_reason')
    .eq('action_type', 'content:cma')
    .eq('target', `cma:${slug.toLowerCase()}`)
    .eq('status', 'killed')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[prospecting] findKilledCmaActionBySlug failed', error.message)
    return null
  }
  const row = (data ?? [])[0] as { id: string; killed_reason: string | null } | undefined
  return row ?? null
}

/**
 * The single "built" definition for a prospect's document (spec 07 §4.1/§4.2).
 * A doc is `ready` only when the resolved `cmas` row matches the expected
 * `doc_type` for this prospect kind, its status is sendable (draft/finalized),
 * and `html_path` is populated and not a `pending:` placeholder.
 */
export async function getBuiltDocForProspect(
  kind: ProspectKind,
  prospect: ProspectDocInput,
): Promise<ProspectDocState> {
  const sb = createServiceClient()
  const expectedType = expectedDocTypeFor(kind)

  let cma: CmaJoinRow | null = null
  try {
    cma = await resolveCmaRow(sb, prospect)
  } catch (e) {
    console.error('[prospecting] getBuiltDocForProspect resolve threw for', prospect.id, e instanceof Error ? e.message : e)
    cma = null
  }

  const accepted = acceptedDocTypesFor(kind)
  const ready =
    !!cma &&
    accepted.includes(cma.doc_type ?? 'cma') &&
    isSendableStatus(cma.status) &&
    !!cma.html_path &&
    !cma.html_path.startsWith('pending:')

  if (ready && cma) {
    const sent = mergeChannelSentState(
      prospect.outreach_sms_sent_at ?? null,
      prospect.outreach_email_sent_at ?? null,
    )
    if (sent) {
      return {
        state: 'sent',
        slug: cma.slug,
        docType: cma.doc_type ?? expectedType,
        recommendedList: cma.recommended_list,
        sentAt: sent.sentAt,
        sid: sent.smsSentAt ? (prospect.outreach_sms_sid ?? null) : null,
        smsSentAt: sent.smsSentAt,
        emailSentAt: sent.emailSentAt,
      }
    }
    return {
      state: 'ready',
      slug: cma.slug,
      docType: cma.doc_type ?? expectedType,
      status: cma.status ?? 'draft',
      recommendedList: cma.recommended_list,
    }
  }

  // No sendable doc — check whether one is in flight or recently failed.
  if (prospect.street_address) {
    const slug = slugifyAddress(prospect.street_address)
    try {
      const open = await findOpenCmaActionBySlug(slug)
      if (open) return { state: 'building', actionId: open.id }
      const killed = await findKilledCmaActionBySlug(sb, slug)
      if (killed) return { state: 'failed', reason: killed.killed_reason }
    } catch (e) {
      console.error('[prospecting] build-status lookup threw for', prospect.id, e instanceof Error ? e.message : e)
    }
  }

  return { state: 'none' }
}
