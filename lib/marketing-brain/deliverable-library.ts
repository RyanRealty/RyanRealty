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

/** A slug we are willing to put in an object path. Keeps traversal out. */
function safeSegment(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** The one place an object path is constructed. Always broker-prefixed. */
export function deliverablePath(brokerSlug: string, actionId: string, filename: string): string {
  return `${safeSegment(brokerSlug)}/${safeSegment(actionId)}/${safeSegment(filename)}`
}

/**
 * True if `path` sits under this broker's prefix.
 *
 * SECURITY: this deliberately compares against a path REBUILT from
 * safeSegment'd parts rather than pattern-matching the caller's string. An
 * earlier version tested `startsWith(prefix) && !includes('..')`, which an
 * adversarial review broke live: Supabase Storage percent-decodes the object
 * key AFTER our check, so `paul-stevenson/%2e%2e/rebecca-peterson/...` passed
 * the guard (no literal `..`, right prefix) and then resolved to another
 * broker's file — a confirmed HTTP 200 on someone else's work product. It also
 * degraded to a wildcard whenever safeSegment(brokerSlug) came out empty
 * (prefix `'/'`, which storage strips). Reconstructing makes both classes
 * unrepresentable: anything that is not exactly `<slug>/<action>/<file>` in
 * canonical form is refused.
 */
export function pathBelongsToBroker(brokerSlug: string, path: string): boolean {
  const slug = safeSegment(brokerSlug)
  if (!slug || typeof path !== 'string' || !path) return false
  let decoded = path
  try {
    // Decode repeatedly: %252e%252e decodes to %2e%2e decodes to ..
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return false // malformed encoding is not a path we own
  }
  if (decoded !== path) return false // canonical form only — no encoded segments
  const parts = decoded.split('/')
  if (parts.length !== 3) return false
  return deliverablePath(parts[0], parts[1], parts[2]) === decoded && parts[0] === slug
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
    const column = value.includes('@') ? 'email' : null
    const { data } = column
      ? await supabase.from('brokers').select('slug').ilike(column, value).maybeSingle()
      : await supabase.from('brokers').select('slug').or(`slug.eq.${value},crm_slug.eq.${value}`).maybeSingle()
    const slug = (data as { slug?: string } | null)?.slug
    return slug ? safeSegment(slug) : null
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
  if (!actionId || !brokerSlug || !filename) return { ok: false, error: 'actionId, brokerSlug and filename are required' }
  const path = deliverablePath(brokerSlug, actionId, filename)
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
