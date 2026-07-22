/**
 * recordSaveListingEvent — mirror a consumer like/save into the first-party
 * visitor store so the CRM behavior panels (getViewedListingsForLead,
 * getContactBehaviorSummary) see the save as an event on the visitor's trail.
 *
 * Called server-side from the ONLY write paths for the consumer stores
 * (app/actions/likes.ts likeListing, app/actions/saved-listings.ts
 * saveListing/resumeSaveListing) AFTER a successful store insert, so the event
 * can never disagree with the durable row.
 *
 * ── Consent + compliance model ──────────────────────────────────────────────
 * The client-side consent level lives in localStorage, unreadable here, so the
 * emitter enforces the two signals it CAN verify:
 *
 *   1. GPC: a Sec-GPC opt-out (read by the caller from request headers) drops
 *      the event entirely — same gate the track route applies
 *      (app/api/visitors/track/route.ts, Phase 8.1).
 *   2. Session existence: visitor sessions are ONLY created by the track route
 *      under a non-declined consent level, so requiring an existing session for
 *      this browser (rr_vid cookie → latest visitor_sessions row) means a
 *      declined visitor never gains an event through this side door.
 *
 * The event itself records a signed-in account action against the user's OWN
 * first-party store — the likes/saved_listings row already persists the same
 * user↔listing pairing durably — so mirroring it as a session event adds no
 * new data category. Never throws; a tracking miss must never break a save.
 *
 * DAL boundary (G1): the raw .from() writes live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/data/client'
import { isGpcOptOut } from '@/lib/crm/gpc'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function recordSaveListingEvent(params: {
  /** Canonical listing key the store row was written with. */
  listingKey: string
  /** Which consumer store the write hit. */
  action: 'like' | 'save'
  /** The rr_vid cookie value from the acting request (may be absent). */
  rrVid: string | null | undefined
  /** The Sec-GPC request header value (compliance gate). */
  secGpcHeader?: string | null
}): Promise<void> {
  try {
    const key = params.listingKey?.trim()
    if (!key) return
    if (isGpcOptOut({ secGpcHeader: params.secGpcHeader ?? null, jsFlag: null })) return
    const rrVid = params.rrVid && UUID_V4.test(params.rrVid) ? params.rrVid : null
    if (!rrVid) return

    const sb = createServiceClient()

    // Latest session for this browser. No session ⇒ tracking never consented
    // (or never ran) in this browser ⇒ no event (see consent model above).
    const { data: sessions } = await sb
      .from('visitor_sessions')
      .select('session_id,source_domain')
      .eq('rr_vid', rrVid)
      .order('last_seen_at', { ascending: false })
      .limit(1)
    const session = sessions?.[0]
    if (!session?.session_id) return

    await sb.from('visitor_events').insert({
      session_id: session.session_id as string,
      source_domain: (session.source_domain as string | null) ?? 'ryan-realty.com',
      event_type: 'save_listing',
      page_url: `https://ryan-realty.com/listing/${encodeURIComponent(key)}`,
      page_category: 'listing_detail',
      listing_mls: key.slice(0, 64),
      metadata: { action: params.action, emitted_by: 'server_action' },
    })
  } catch {
    /* best-effort — never block or fail the save/like on a tracking write */
  }
}
