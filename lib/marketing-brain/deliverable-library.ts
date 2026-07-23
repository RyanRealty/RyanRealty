/**
 * deliverable-library — durable storage for finished marketing deliverables,
 * scoped per broker (W10.2).
 *
 * Producers hand back their output inline in
 * marketing_brain_actions.executor_response, or as a local out/ path that dies
 * with the runner. Nothing survived for a broker to come back to. This module
 * persists a finished deliverable into the private `marketing-deliverables`
 * bucket and reads it back.
 *
 * SECURITY — broker scoping is structural, not a filter you can forget:
 *   - every object path is `<brokerSlug>/<actionId>/<filename>`, so a path
 *     cannot exist outside some broker's prefix;
 *   - every read takes a brokerSlug and lists ONLY that prefix — there is no
 *     "list everything" export to accidentally call;
 *   - a download re-validates that the requested path sits under the caller's
 *     prefix before minting a signed URL, so passing another broker's path is
 *     refused even if it leaks into a client.
 * ci:deliverable-library-scope holds these properties.
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  safeSegment,
  buildDeliverablePath,
  pathBelongsToBroker,
} from '@/lib/marketing-brain/deliverable-path'

export { pathBelongsToBroker, safeSegment } from '@/lib/marketing-brain/deliverable-path'

export const DELIVERABLE_BUCKET = 'marketing-deliverables'
/** Signed download URLs are short-lived; a library page mints them per render. */
export const DOWNLOAD_TTL_SECONDS = 300
/**
 * Where a deliverable lands when no broker can be resolved. Matt is the
 * principal broker and the default approver, so unattributed work is visible to
 * someone rather than orphaned in a prefix no surface reads. Canonical
 * brokers.slug namespace — never the crm_slug ('matt').
 */
export const FALLBACK_BROKER_SLUG = 'matthew-ryan'

export interface DeliverableRef {
  actionId: string
  brokerSlug: string
  filename: string
  /** Full object path inside the bucket: `<brokerSlug>/<actionId>/<filename>`. */
  path: string
  sizeBytes: number | null
  createdAt: string | null
}

/**
 * The one place an object path is constructed. Always broker-prefixed.
 * Throws on an unrepresentable segment rather than returning a mangled key —
 * every caller here has already validated, so reaching the throw is a bug.
 */
export function deliverablePath(brokerSlug: string, actionId: string, filename: string): string {
  const path = buildDeliverablePath(brokerSlug, actionId, filename)
  if (!path) throw new Error('deliverablePath: unsafe segment')
  return path
}


/**
 * Whose library does this action's output belong to?
 *
 * The request came in through one of the two intakes, so the requesting broker
 * is the intake row's sender: marketing_inbox_events.action_row_id -> that row's
 * sender_email -> public.brokers.email -> slug. Brain-generated work (no intake
 * row) falls back to the row's assigned_approver, and finally to `matt`, so a
 * deliverable always lands in exactly one broker's library rather than nowhere.
 * Never throws.
 */
/**
 * public.brokers carries TWO slug namespaces: `slug` ('matthew-ryan') and
 * `crm_slug` ('matt'). Different producers hand us different ones —
 * marketing_brain_actions.assigned_approver is the CRM namespace, while the
 * library surface reads brokers.slug. Storing under whichever string arrived
 * would split one broker's library across two prefixes and show them an empty
 * page, so every identifier is canonicalized to brokers.slug before it is ever
 * used as a path segment. Returns null when the reference matches no broker.
 */
async function canonicalBrokerSlug(ref: string | null): Promise<string | null> {
  const value = (ref ?? '').trim().toLowerCase()
  if (!value) return null
  try {
    const supabase = createServiceClient()
    // NOTE: no ilike here. `value` can be an inbound From: header
    // (marketing_inbox_events.sender_email), and ilike treats % and _ as
    // wildcards — 'p%@ryan-realty.com' resolved to paul-stevenson and
    // '_ebeccapeterson@...' to rebecca-peterson in review, both from addresses
    // that pass the domain allowlist. Emails are stored lowercase-comparable,
    // so an exact match on the lowercased value is both safe and correct.
    // Likewise the slug branch uses two eq filters rather than interpolating
    // into .or(), whose comma/dot syntax an attacker-shaped value could bend.
    if (value.includes('@')) {
      const { data } = await supabase
        .from('brokers')
        .select('slug, email')
        .eq('is_active', true)
      const match = (data ?? []).find(
        (b) => ((b as { email?: string }).email ?? '').trim().toLowerCase() === value,
      ) as { slug?: string } | undefined
      return match?.slug ? safeSegment(match.slug) : null
    }
    const { data } = await supabase
      .from('brokers')
      .select('slug, crm_slug')
      .eq('is_active', true)
    const hit = (data ?? []).find(
      (b) =>
        ((b as { slug?: string }).slug ?? '').toLowerCase() === value ||
        ((b as { crm_slug?: string }).crm_slug ?? '').toLowerCase() === value,
    ) as { slug?: string } | undefined
    return hit?.slug ? safeSegment(hit.slug) : null
  } catch {
    return null
  }
}

export async function resolveBrokerSlugForAction(actionId: string): Promise<string> {
  if (!actionId) return FALLBACK_BROKER_SLUG
  try {
    const supabase = createServiceClient()
    const { data: event } = await supabase
      .from('marketing_inbox_events')
      .select('sender_email')
      .eq('action_row_id', actionId)
      .maybeSingle()

    const byEmail = await canonicalBrokerSlug(event?.sender_email ?? null)
    if (byEmail) return byEmail

    const { data: action } = await supabase
      .from('marketing_brain_actions')
      .select('assigned_approver')
      .eq('id', actionId)
      .maybeSingle()

    const byApprover = await canonicalBrokerSlug(action?.assigned_approver ?? null)
    if (byApprover) return byApprover

    return FALLBACK_BROKER_SLUG
  } catch {
    return FALLBACK_BROKER_SLUG
  }
}

/**
 * Persist a finished deliverable. Called when a producer completes, so the
 * output outlives the run. Never throws — persistence failing must not fail the
 * producer run that already succeeded.
 */
export async function persistDeliverable(input: {
  actionId: string
  brokerSlug: string
  filename: string
  body: string | Uint8Array
  contentType?: string
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { actionId, brokerSlug, filename, body } = input
  // Validate the SANITIZED segments, not the raw ones. Checking truthiness of
  // the inputs first let '!!!' / '-' / ' ' through — they sanitize to '' and
  // the object landed at bucket root with no broker prefix at all (confirmed
  // live in review), invisible to every library and listable by anyone whose
  // slug happened to match the action id.
  const path = buildDeliverablePath(brokerSlug, actionId, filename)
  if (!path) {
    return { ok: false, error: 'actionId, brokerSlug and filename must each contain usable characters' }
  }
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(DELIVERABLE_BUCKET).upload(path, body, {
      contentType: input.contentType ?? 'application/octet-stream',
      upsert: true,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, path }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'upload failed' }
  }
}

/**
 * Every deliverable belonging to ONE broker. There is deliberately no
 * list-all-brokers variant: a caller must name whose library it is reading.
 */
export async function listBrokerDeliverables(brokerSlug: string): Promise<DeliverableRef[]> {
  const slug = safeSegment(brokerSlug)
  if (!slug) return []
  try {
    const supabase = createServiceClient()
    // One level down from the broker prefix is the action folder.
    const { data: actionFolders, error } = await supabase.storage
      .from(DELIVERABLE_BUCKET)
      .list(slug, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    if (error || !actionFolders) return []

    const refs: DeliverableRef[] = []
    for (const folder of actionFolders) {
      const actionId = folder.name
      const { data: files } = await supabase.storage
        .from(DELIVERABLE_BUCKET)
        .list(`${slug}/${actionId}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
      for (const file of files ?? []) {
        refs.push({
          actionId,
          brokerSlug: slug,
          filename: file.name,
          path: `${slug}/${actionId}/${file.name}`,
          sizeBytes: (file.metadata as { size?: number } | null)?.size ?? null,
          createdAt: file.created_at ?? null,
        })
      }
    }
    return refs
  } catch {
    return []
  }
}

/**
 * Mint a short-lived download URL for ONE of this broker's deliverables.
 *
 * Takes the PARTS, not a path. The object key is rebuilt here from
 * safeSegment'd segments, so a caller cannot hand us a traversal, an
 * encoded traversal, or another broker's key at all — the dangerous input
 * simply has nowhere to enter. `pathBelongsToBroker` is then asserted on the
 * reconstructed key as defense in depth.
 */
export async function signDeliverableDownload(
  brokerSlug: string,
  actionId: string,
  filename: string,
): Promise<string | null> {
  const slug = safeSegment(brokerSlug)
  if (!slug || !safeSegment(actionId) || !safeSegment(filename)) return null
  const path = deliverablePath(slug, actionId, filename)
  if (!pathBelongsToBroker(slug, path)) return null
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage
      .from(DELIVERABLE_BUCKET)
      .createSignedUrl(path, DOWNLOAD_TTL_SECONDS)
    if (error) return null
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}
