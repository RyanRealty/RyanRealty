/**
 * Visitor cookie for anonymous tracking. Merge into user on sign-up.
 * Step 18.
 */

import { cookies } from 'next/headers'

const VISITOR_COOKIE = 'rr_visitor'
const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get or create visitor ID (HTTP-only cookie). Call from server.
 */
export async function getOrCreateVisitorId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(VISITOR_COOKIE)?.value
  if (existing?.match(/^[a-f0-9-]{36}$/i)) return existing
  const id = uuid()
  cookieStore.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return id
}

/**
 * Get visitor ID without creating. Returns null if not set.
 */
export async function getVisitorId(): Promise<string | null> {
  const cookieStore = await cookies()
  const v = cookieStore.get(VISITOR_COOKIE)?.value
  return v?.match(/^[a-f0-9-]{36}$/i) ? v : null
}
