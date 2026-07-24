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

export { pathBelongsToBroker, safeSegment, buildDeliverablePath } from '@/lib/marketing-brain/deliverable-path'

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
 * Whose library does this action's output belong to?
 *
 * Delegates to public.resolve_deliverable_broker_slug — ONE implementation,
 * because there are two callers in two runtimes: this module and the plain-.mjs
 * render worker. Round 3 of review found them disagreeing: the app resolved the
 * intake sender first, the worker read only assigned_approver (which is 'matt'
 * on every live row), so every visual deliverable Paul or Rebecca requested
 * landed in Matt's library while their own page read "Nothing here yet."
 *
 * The function returns the canonical brokers.slug namespace, never crm_slug.
 * Never throws.
 */
export async function resolveBrokerSlugForAction(actionId: string): Promise<string> {
  if (!actionId) return FALLBACK_BROKER_SLUG
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('resolve_deliverable_broker_slug', {
      p_action_id: actionId,
    })
    if (error || typeof data !== 'string' || !data) return FALLBACK_BROKER_SLUG
    return safeSegment(data) || FALLBACK_BROKER_SLUG
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
  // buildDeliverablePath, NOT deliverablePath: the latter THROWS, and a
  // truthy safeSegment() is not the same thing as a representable key. A
  // 125-character filename sanitizes to a truthy 120-char segment that is not
  // equal to its input, so the builder refuses it while the old truthiness
  // pre-check passed — the throw then escaped this function, out through the
  // page's Promise.all, and 500'd the whole library for that broker (one
  // stray object took every good deliverable down with it). Refuse by
  // returning null, the way every other failure here does.
  const path = buildDeliverablePath(slug, actionId, filename)
  if (!path) return null
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
