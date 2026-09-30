'use client'

/**
 * Client fire path for search-funnel events (Phase 0.5).
 *
 * Routes through the EXISTING user_events pipeline — the trackUserEvent server
 * action (the same path listing_view uses), so no raw .from() in components
 * (§7 DAL boundary) and no parallel event store. Session id is the same
 * rr_session_id the page_view pipeline stitches visitors with.
 *
 * Gated like every tracker (docs/TRACKING_POLICY.md, lib/identity/consent.ts): a
 * visitor who declined, or whose browser sends Global Privacy Control, is recorded
 * nowhere and gets no session id. Until 2026-09-30 this path had no check, and it
 * minted the id and recorded the search whatever the visitor had answered. The
 * server action refuses the same requests.
 *
 * Fire-and-forget by contract: never blocks UI, swallows every error.
 */

import { trackUserEvent } from '@/app/actions/track-user-event'
import { currentConsentLevel, getOrCreateSessionId } from '@/components/VisitTracker'
import { gpcFromNavigator } from '@/lib/identity/consent'
import {
  createSearchEventGuard,
  type SearchEventPayload,
  type SearchEventType,
} from '@/lib/search/search-events'

// ONE module-level guard: a single user action that renders twice (strict
// mode, re-entrant handlers) still records exactly one row.
const shouldFire = createSearchEventGuard()

export function fireSearchEvent(eventType: SearchEventType, payload: SearchEventPayload): void {
  if (typeof window === 'undefined') return
  // Before anything is minted or sent: a decline and GPC leave no trace.
  if (currentConsentLevel() === 'declined' || gpcFromNavigator(navigator)) return
  if (!shouldFire(eventType, payload, Date.now())) return
  try {
    trackUserEvent({
      eventType,
      sessionId: getOrCreateSessionId(),
      pagePath: window.location.pathname,
      payload,
    }).catch(() => {})
  } catch {
    // never block or surface tracking failures
  }
}
