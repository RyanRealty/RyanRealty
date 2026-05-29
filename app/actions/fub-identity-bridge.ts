'use server'

import { cookies } from 'next/headers'
import { sendEvent } from '@/lib/followupboss'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import { backfillSessionToFub } from '@/lib/visitor-backfill'

const FUB_CID_COOKIE = 'fub_cid'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Called when user lands with FUB email-click param (e.g. ?_fuid=123).
 * Sets first-party cookie linking this browser to the FUB contact; sends "Visited Website" so FUB merges the session.
 * When the client also passes its rr_session_id, we stitch this browser's
 * prior anonymous browsing history to the now-known FUB person.
 * Run before any other logic (client component on mount).
 */
export async function identifyFubFromEmailClick(
  fubPersonId: string,
  sessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const raw = String(fubPersonId).trim()
  const id = parseInt(raw, 10)
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid FUB person id' }

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const res = await sendEvent({
    type: 'Visited Website',
    person: { id },
    source,
    system: 'Ryan Realty Website',
    sourceUrl: undefined,
  })
  if (!res.ok) return { ok: false, error: res.error ?? 'FUB event failed' }

  const cookieStore = await cookies()
  cookieStore.set(FUB_CID_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  // GA4 Measurement Protocol — record that this browser was just bridged
  // to a FUB person id. Helps us count email-click identifications in the
  // analytics funnel and ties future events on this browser to a known FUB id.
  const ga4ClientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
  void fireGa4Event({
    eventName: 'fub_person_created',
    clientId: ga4ClientId,
    eventParams: {
      fub_person_id: id,
      source: 'email-click',
    },
  }).catch((e) => console.warn('[fub-bridge] GA4 event failed:', e))

  // Stitch this browser's prior anonymous browsing history to the FUB person.
  // The email click is high-confidence identity (the link carried their id),
  // so replaying their anonymous session is exactly the "put a name to the
  // number" moment. No email here — the FUB id is the join key. Non-blocking.
  if (sessionId && UUID_V4_RE.test(sessionId)) {
    void backfillSessionToFub({
      sessionId,
      fubPersonId: id,
      identifiedVia: 'email_click_fuid',
    }).catch((e) => console.warn('[fub-bridge] session backfill failed (non-blocking):', e))
  }

  return { ok: true }
}

/**
 * Read FUB contact id from first-party cookie (set by identity bridge). Use when sending events for anonymous-but-identified visitors.
 */
export async function getFubPersonIdFromCookie(): Promise<number | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(FUB_CID_COOKIE)?.value?.trim()
  if (!value) return null
  const id = parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}
