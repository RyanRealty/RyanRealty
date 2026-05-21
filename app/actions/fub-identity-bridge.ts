'use server'

import { cookies } from 'next/headers'
import { sendEvent } from '@/lib/followupboss'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'

const FUB_CID_COOKIE = 'fub_cid'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days

/**
 * Called when user lands with FUB email-click param (e.g. ?_fuid=123).
 * Sets first-party cookie linking this browser to the FUB contact; sends "Visited Website" so FUB merges the session.
 * Run before any other logic (client component on mount).
 */
export async function identifyFubFromEmailClick(fubPersonId: string): Promise<{ ok: boolean; error?: string }> {
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
