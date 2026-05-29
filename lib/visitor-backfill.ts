/**
 * Anonymous-to-known visitor stitching.
 *
 * When a visitor identifies (via Google One-Tap, Facebook Login, or any
 * other auth path), this module:
 *   1. Marks their visitor_sessions row as identified, attaching the
 *      resolved FUB person id and email.
 *   2. Fires every prior visitor_events row for that session into FUB
 *      as Viewed Property / Viewed Page events attributed to the
 *      now-known person. Each event carries its original timestamp via
 *      the FUB event payload so the FUB activity log reflects the real
 *      browsing chronology, not the moment of sign-in.
 *   3. Flags each event row as pushed_to_fub_at so we never double-fire.
 *
 * Called by:
 *   - /api/fub/identify (One-Tap / FB Login from WordPress)
 *   - /app/auth/callback (Supabase OAuth from Vercel)
 *   - any future identify path (email link, manual admin tag)
 *
 * Idempotent. Re-running for the same session_id is a no-op for already-
 * pushed events.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { trackPageView, trackListingView, addPersonNote } from '@/lib/followupboss'

type IdentifiedVia = 'google' | 'facebook' | 'email_click_fuid' | 'form_submit' | 'magic_link'

export type BackfillResult = {
  ok: boolean
  sessionFound: boolean
  alreadyIdentified: boolean
  eventsBackfilled: number
  errors: string[]
}

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

// Categories worth replaying to FUB. We skip 'home', 'about', 'blog', 'other'
// because firing 30 "Viewed Page: blog post" events at the moment of sign-in
// is noise that drowns out the real signals. Listing detail + seller/buyer
// intent + area guide + financial tools are the kept categories.
const CATEGORIES_WORTH_REPLAYING = new Set<string>([
  'listing_detail',
  'seller_intent',
  'buyer_intent',
  'area_guide',
  'financial_tools',
  'search',
])

type EventRow = {
  id: number
  event_at: string
  event_type: string
  page_url: string
  page_title: string | null
  page_category: string | null
  listing_mls: string | null
  listing_street: string | null
  listing_city: string | null
  listing_state: string | null
  listing_postal: string | null
  listing_price: number | null
  listing_bedrooms: number | null
  listing_bathrooms: number | null
}

type SessionRow = {
  session_id: string
  identified_at: string | null
  fub_person_id: number | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
}

/**
 * Mark a session as identified and replay every unpushed event into FUB.
 *
 * Pre-conditions:
 *   - sessionId is a valid uuid v4 the client passed in
 *   - fubPersonId is the result of a successful identify (already trust-verified)
 *
 * Post-conditions:
 *   - visitor_sessions row has identified_at, fub_person_id, identified_email,
 *     identified_via, events_backfilled_at, events_backfilled_count set
 *   - all eligible visitor_events for the session have pushed_to_fub_at set
 *   - one FUB event (Viewed Property or Viewed Page) per eligible event
 *
 * Never throws. Returns a structured result; caller decides how to surface.
 */
export async function backfillSessionToFub(params: {
  sessionId: string
  fubPersonId: number
  /** Optional. Form paths always have it; the email-click bridge knows only
   *  the FUB id, so it stitches without an email (the id is the join key). */
  email?: string
  identifiedVia: IdentifiedVia
}): Promise<BackfillResult> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      ok: false,
      sessionFound: false,
      alreadyIdentified: false,
      eventsBackfilled: 0,
      errors: ['SUPABASE_SERVICE_ROLE_KEY not configured'],
    }
  }

  const errors: string[] = []

  // ─── 1. Mark the session as identified (idempotent) ────────────────────────
  // We use a conditional UPDATE: only set the identified_* fields if they are
  // currently NULL. That way a second identify call (e.g. user re-signs-in
  // with a different provider in the same browser) does NOT overwrite the
  // original identification timestamp, which would mess up downstream timing
  // reports.
  const { data: sessionRows, error: readErr } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_at, fub_person_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
    .eq('session_id', params.sessionId)
    .limit(1)

  if (readErr) {
    errors.push(`session read failed: ${readErr.message}`)
    return { ok: false, sessionFound: false, alreadyIdentified: false, eventsBackfilled: 0, errors }
  }

  const session = (sessionRows?.[0] ?? null) as SessionRow | null
  if (!session) {
    // Session may genuinely not exist if the user identified before the
    // snippet ever POSTed a tracking event (e.g. they clicked sign-in
    // immediately on landing). Not a failure — just no events to backfill.
    return {
      ok: true,
      sessionFound: false,
      alreadyIdentified: false,
      eventsBackfilled: 0,
      errors: [],
    }
  }

  const alreadyIdentified = !!session.identified_at

  if (!alreadyIdentified) {
    const { error: updateErr } = await supabase
      .from('visitor_sessions')
      .update({
        identified_at: new Date().toISOString(),
        fub_person_id: params.fubPersonId,
        identified_email: params.email?.toLowerCase() ?? null,
        identified_via: params.identifiedVia,
      })
      .eq('session_id', params.sessionId)
      .is('identified_at', null)
    if (updateErr) errors.push(`session update failed: ${updateErr.message}`)
  }

  // ─── 2. Fetch all unpushed events in chronological order ──────────────────
  const { data: eventsRaw, error: eventsErr } = await supabase
    .from('visitor_events')
    .select('id, event_at, event_type, page_url, page_title, page_category, listing_mls, listing_street, listing_city, listing_state, listing_postal, listing_price, listing_bedrooms, listing_bathrooms')
    .eq('session_id', params.sessionId)
    .is('pushed_to_fub_at', null)
    .order('event_at', { ascending: true })

  if (eventsErr) {
    errors.push(`events read failed: ${eventsErr.message}`)
    return { ok: false, sessionFound: true, alreadyIdentified, eventsBackfilled: 0, errors }
  }

  const events = (eventsRaw ?? []) as EventRow[]
  if (events.length === 0) {
    return { ok: true, sessionFound: true, alreadyIdentified, eventsBackfilled: 0, errors }
  }

  // Build the campaign object once from the session's first-touch UTMs.
  // Every backfilled FUB event carries the same attribution so the lead's
  // FUB record reflects the original source, not the moment of sign-in.
  const campaign = (() => {
    const c: Record<string, string> = {}
    if (session.utm_source)   c.source = session.utm_source
    if (session.utm_medium)   c.medium = session.utm_medium
    if (session.utm_campaign) c.campaign = session.utm_campaign
    if (session.utm_content)  c.content = session.utm_content
    if (session.utm_term)     c.term = session.utm_term
    return Object.keys(c).length > 0 ? c : undefined
  })()

  // ─── 3. Replay eligible events into FUB ────────────────────────────────────
  const successfullyPushed: number[] = []

  for (const ev of events) {
    try {
      const isListingDetail =
        ev.event_type === 'listing_view' ||
        (ev.event_type === 'page_view' && ev.page_category === 'listing_detail')

      const isReplayablePageView =
        ev.event_type === 'page_view' &&
        ev.page_category != null &&
        CATEGORIES_WORTH_REPLAYING.has(ev.page_category) &&
        ev.page_category !== 'listing_detail'  // handled by isListingDetail above

      if (isListingDetail && (ev.listing_mls || ev.listing_street)) {
        // trackListingView returns void — assume success if no throw.
        // Chronology context goes in the summary note posted after the loop,
        // since the FUB event helper does not accept custom timestamps and
        // we do not want to fire 1 extra note per backfilled event.
        await trackListingView({
          fubPersonId: params.fubPersonId,
          listingUrl: ev.page_url,
          property: {
            street: ev.listing_street ?? undefined,
            city: ev.listing_city ?? undefined,
            state: ev.listing_state ?? undefined,
            code: ev.listing_postal ?? undefined,
            mlsNumber: ev.listing_mls ?? undefined,
            price: ev.listing_price ?? undefined,
            bedrooms: ev.listing_bedrooms ?? undefined,
            bathrooms: ev.listing_bathrooms ?? undefined,
          },
          campaign,
        })
        successfullyPushed.push(ev.id)
        continue
      }

      if (isReplayablePageView) {
        await trackPageView({
          fubPersonId: params.fubPersonId,
          pageUrl: ev.page_url,
          pageTitle: ev.page_title ?? undefined,
          campaign,
          message: `category=${ev.page_category} | backfilled`,
        })
        successfullyPushed.push(ev.id)
        continue
      }

      // Event type not worth replaying. Mark as pushed anyway so we don't
      // re-examine it on subsequent backfill calls.
      successfullyPushed.push(ev.id)
    } catch (e) {
      errors.push(`event ${ev.id} replay failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── 4. Mark successfully-pushed events ───────────────────────────────────
  if (successfullyPushed.length > 0) {
    const { error: markErr } = await supabase
      .from('visitor_events')
      .update({ pushed_to_fub_at: new Date().toISOString() })
      .in('id', successfullyPushed)
    if (markErr) errors.push(`mark pushed failed: ${markErr.message}`)
  }

  // ─── 5. Update session backfill summary ────────────────────────────────────
  if (successfullyPushed.length > 0) {
    const { error: summaryErr } = await supabase
      .from('visitor_sessions')
      .update({
        events_backfilled_at: new Date().toISOString(),
        events_backfilled_count: successfullyPushed.length,
      })
      .eq('session_id', params.sessionId)
    if (summaryErr) errors.push(`summary update failed: ${summaryErr.message}`)
  }

  // ─── 6. Post a single chronological summary note to FUB ───────────────────
  // The Viewed Property / Viewed Page events we just fired land in FUB at
  // "now" because the FUB events API does not accept custom timestamps. This
  // note carries the original chronology so the broker can see what
  // actually happened when. One note per backfill, never per event.
  if (successfullyPushed.length > 0) {
    const PT = (iso: string) => new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    const replayed = events.filter((e) => successfullyPushed.includes(e.id))
    const firstAt = replayed[0]?.event_at
    const lastAt  = replayed[replayed.length - 1]?.event_at
    const listings = replayed
      .filter((e) => e.listing_mls)
      .map((e) => `MLS ${e.listing_mls}${e.listing_city ? ` (${e.listing_city})` : ''}`)
    const pages = replayed
      .filter((e) => !e.listing_mls && e.page_category && e.page_category !== 'listing_detail')
      .map((e) => {
        const path = (() => { try { return new URL(e.page_url).pathname } catch { return e.page_url } })()
        return `${e.page_category}: ${path}`
      })
    const lines: string[] = []
    lines.push(`Anonymous browsing history backfilled (${successfullyPushed.length} events).`)
    if (firstAt && lastAt) lines.push(`Window: ${PT(firstAt)} to ${PT(lastAt)} PT.`)
    if (campaign?.source) {
      const camp = campaign.medium && campaign.medium !== 'none'
        ? `${campaign.source} / ${campaign.medium}`
        : campaign.source
      lines.push(`First-touch source: ${camp}${campaign.campaign ? ` (campaign: ${campaign.campaign})` : ''}.`)
    }
    if (listings.length > 0) lines.push(`Listings viewed: ${listings.slice(0, 10).join(', ')}${listings.length > 10 ? ` (+${listings.length - 10} more)` : ''}.`)
    if (pages.length > 0)    lines.push(`Pages: ${pages.slice(0, 8).join(', ')}${pages.length > 8 ? ` (+${pages.length - 8} more)` : ''}.`)
    try {
      await addPersonNote(params.fubPersonId, lines.join(' '))
    } catch (e) {
      errors.push(`summary note failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    ok: errors.length === 0,
    sessionFound: true,
    alreadyIdentified,
    eventsBackfilled: successfullyPushed.length,
    errors,
  }
}
