'use server'

import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CONSENT_COOKIE, recordingAllowed } from '@/lib/identity/consent'

export type UserEventType =
  | 'page_view'
  | 'listing_view'
  | 'listing_click'
  | 'listing_save'
  | 'listing_unsave'
  | 'listing_like'
  | 'listing_unlike'
  | 'search'
  | 'share_click'
  // Search-funnel instrumentation (Phase 0.5) — payload shapes built by
  // lib/search/search-events.ts, fired via components/search/search-events.client.ts.
  | 'search_filter_apply'
  | 'search_map_draw'
  | 'search_save'
  | 'alert_create'
  | 'search_zero_results'

/**
 * One row in user_events. Refused, as every tracker's event is
 * (docs/TRACKING_POLICY.md), for a visitor whose banner answer is a decline or whose
 * browser sends Global Privacy Control: the callers gate on the same thing, and a
 * client cannot widen it.
 */
export async function trackUserEvent(params: {
  eventType: UserEventType
  sessionId?: string | null
  pagePath?: string | null
  listingKey?: string | null
  payload?: Record<string, unknown> | null
}) {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()])
  if (!recordingAllowed({ consentCookie: cookieStore.get(CONSENT_COOKIE)?.value ?? null, secGpc: hdrs.get('sec-gpc') })) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('user_events').insert({
    user_id: user?.id ?? null,
    session_id: params.sessionId?.slice(0, 512) ?? null,
    event_type: params.eventType,
    page_path: params.pagePath?.slice(0, 2048) ?? null,
    listing_key: params.listingKey?.trim() || null,
    payload: params.payload ?? null,
  })
}
