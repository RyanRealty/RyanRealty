/**
 * GET /api/identity/me
 *
 * Returns the hashed identity tokens for the current visitor — used by
 * `<AnalyticsIdentityBridge />` to wire GA4 `user_id` and Meta Pixel
 * advanced matching once a visitor is known.
 *
 * Why a dedicated endpoint:
 *   The root layout is a Server Component that intentionally reads NO
 *   cookies (so the CDN can cache the static HTML — SITE_SPEC §45-47).
 *   GA4 user_id + Meta `em` therefore need a client-side fetch path. This
 *   endpoint encapsulates the hashing so no raw PII ever lands in the
 *   browser bundle.
 *
 * Response shape:
 *   {
 *     identified:   boolean    // true if we know the visitor at all
 *     hashedUserId: string?    // stable GA4 user_id ("fub-<sha256>" or "em-<sha256>")
 *     hashedEmail:  string?    // sha256(normalized email) for Meta Pixel `em`
 *     fubPersonId:  number?    // FUB person id for client-side context
 *   }
 *
 * Identity resolution priority (most stable first):
 *   1. fub_cid cookie (FUB person id stamped via email-click or form submit)
 *   2. signed-in session email (Google OAuth via Supabase)
 *   Returns identified=false if neither is present.
 *
 * Cache-Control: private, no-store — never cache at the edge.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { getSession } from '@/app/actions/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FUB_CID_COOKIE = 'fub_cid'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export async function GET(): Promise<NextResponse> {
  const [cookieStore, session] = await Promise.all([cookies(), getSession()])

  const fubCidRaw = cookieStore.get(FUB_CID_COOKIE)?.value?.trim()
  const fubPersonId = fubCidRaw ? parseInt(fubCidRaw, 10) : null
  const fubIdValid = Number.isFinite(fubPersonId) && (fubPersonId ?? 0) > 0

  const rawEmail = session?.user?.email?.trim().toLowerCase()
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null

  // GA4 user_id: prefer the cookie-stamped FUB person (works for unauthenticated
  // visitors who clicked a FUB email; survives sign-out). Fall back to a hashed
  // email when we only have a signed-in session.
  let hashedUserId: string | null = null
  if (fubIdValid) {
    hashedUserId = `fub-${sha256(String(fubPersonId))}`
  } else if (email) {
    hashedUserId = `em-${sha256(email)}`
  }

  // Meta Pixel advanced matching takes a sha256 of the normalized email.
  const hashedEmail = email ? sha256(email) : null

  return NextResponse.json(
    {
      identified: hashedUserId !== null,
      hashedUserId,
      hashedEmail,
      fubPersonId: fubIdValid ? fubPersonId : null,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    },
  )
}
