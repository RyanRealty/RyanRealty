/**
 * saveAnonymousPartialAddress — capture a typed address from an LP step-1
 * advance even when the visitor has no cookie identity (anonymous).
 *
 * Writes a `seller_intent` visitor_event row keyed by sessionId with the
 * partial address in the metadata payload. This mirrors the pattern used by
 * the existing visitor tracking API (/api/visitors/track/route.ts) but runs
 * server-side inside an LP server action so it fires even when the client-side
 * tracking snippet hasn't loaded or is blocked by an ad-blocker.
 *
 * DAL boundary rules (CLAUDE.md — Data Access Discipline):
 *   - All Supabase writes from lib/data/ use the service role client or the
 *     anon client from @/lib/data/client. Direct createClient is acceptable
 *     inside lib/data/ because the client module itself does the key wiring.
 *   - The raw .from() call is INSIDE lib/data/ — not in an action or page —
 *     so the DAL boundary gate (G1 / check-dal-boundary.mjs) is satisfied.
 *
 * NOTE: If the `visitor_events` table schema ever changes, regenerate
 * docs/DATABASE_SCHEMA_SNAPSHOT.md via `npm run ci:data-access -- --refresh`.
 *
 * Called fire-and-forget from:
 *   - app/lp/seller-home-value/actions.ts  (existing saveSellerPartialLead)
 *   - app/lp/expired-listing/actions.ts    (new saveExpiredPartialAddress)
 *
 * Never throws — partial-lead capture must never affect the UI step change.
 */

import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AnonymousPartialAddressInput = {
  /** UUID v4 from localStorage (rr_session_id). Required — no session = no row. */
  sessionId: string | undefined
  /** The address string the visitor typed and advanced past. */
  address: string
  /** Which LP surface sent this (for analytics). */
  lpSurface: 'seller-lp' | 'expired-lp' | 'fsbo-lp'
  /** Full page URL (e.g. https://ryan-realty.com/lp/seller-home-value). */
  pageUrl?: string
}

/**
 * Write a seller_intent visitor_event row with the partial address in metadata.
 * Safe to call without awaiting — errors are swallowed and logged only.
 */
export async function saveAnonymousPartialAddress(
  input: AnonymousPartialAddressInput,
): Promise<void> {
  try {
    const { sessionId, address, lpSurface, pageUrl } = input

    // Validate inputs — skip if anything critical is missing.
    if (!sessionId || !UUID_V4_RE.test(sessionId)) return
    const trimmed = address?.trim() ?? ''
    if (trimmed.length < 4) return

    const supabase = getServiceSupabase()
    if (!supabase) return

    const siteUrl =
      (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
    const defaultPageUrl =
      lpSurface === 'seller-lp'
        ? `${siteUrl}/lp/seller-home-value`
        : lpSurface === 'fsbo-lp'
          ? `${siteUrl}/lp/fsbo`
          : `${siteUrl}/lp/expired-listing`

    const eventRow: Record<string, unknown> = {
      session_id: sessionId,
      event_type: 'seller_intent',
      page_url: pageUrl ?? defaultPageUrl,
      page_title:
        lpSurface === 'seller-lp'
          ? 'Seller LP — address step (anonymous partial)'
          : lpSurface === 'fsbo-lp'
            ? 'FSBO LP — address step (anonymous partial)'
            : 'Expired Listing LP — address step (anonymous partial)',
      page_category: 'seller_intent',
      metadata: {
        partial_address: trimmed,
        lp_surface: lpSurface,
        captured_at_step: 'step1_advance_anonymous',
      },
      score_delta: 3, // modest intent signal — address typed + advanced
    }

    const { error } = await supabase.from('visitor_events').insert(eventRow)
    if (error) {
      console.warn('[saveAnonymousPartialAddress] insert failed (non-blocking):', error.message)
    }
  } catch (e) {
    // Intentionally swallowed. Never surface a DB error to the LP visitor.
    console.warn('[saveAnonymousPartialAddress] unexpected error (non-blocking):', e)
  }
}
