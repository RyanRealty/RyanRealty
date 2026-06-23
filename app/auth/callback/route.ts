import { createClient } from '@/lib/supabase/server'
import { trackSignedInUser, findPersonByEmail } from '@/lib/followupboss'
import { stitchVisitorIdentity } from '@/lib/visitor-backfill'
import { claimGuestSavedSearches } from '@/lib/data/savedSearches'
import type { User } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'

const AUTH_NEXT_COOKIE = 'auth_next'
const FUB_CID_COOKIE = 'fub_cid'
const FUB_CID_MAX_AGE = 90 * 24 * 60 * 60 // 90 days — matches identifyFubFromEmailClick

/**
 * Stamp the durable fub_cid cookie on a freshly signed-in visitor by resolving
 * their FUB person from the sign-in email. This makes every FUTURE visit on this
 * browser attributable to the FUB contact (via getFubPersonIdFromCookie in the
 * visitor-tracking path) — which is what generates "Visited Website" activity in
 * FUB and lifts the visit-to-FUB bridge rate that was sitting at ~2%. Best-effort:
 * a brand-new contact not yet in FUB simply gets stamped on a later visit. Never
 * blocks or fails sign-in.
 */
async function stampFubCidFromEmail(
  res: NextResponse,
  email: string,
  rrVid: string | undefined,
  userId: string | undefined,
  source: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return
  try {
    const person = await findPersonByEmail(normalized)
    if (person?.id) {
      res.cookies.set(FUB_CID_COOKIE, String(person.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: FUB_CID_MAX_AGE,
        path: '/',
      })
    }
    // Phase 7 -> Phase 5: feed the login into the first-party identity graph so a
    // Google/Facebook/email sign-in stitches the durable rr_vid cookie to the
    // known person/email/auth-user (same graph a form submit writes). Best-effort.
    await stitchVisitorIdentity({
      rrVid,
      fubPersonId: person?.id ?? null,
      email: normalized,
      userId: userId ?? null,
      source,
    })
  } catch (err) {
    Sentry.captureException(err)
  }
}

/**
 * CONTACT360 Phase 7.3 — claim-on-sign-in. Attach a guest's email-keyed saved
 * searches (guest_search_alerts) to their account on first sign-in so they are
 * not orphaned. EMAIL-VERIFICATION GATED: only claim when Supabase reports the
 * account email as confirmed (user.email_confirmed_at). The OAuth + magic-link +
 * recovery flows that reach this callback all verify the email, but we re-check
 * the field so we never attach another person's guest searches to an account on
 * an unverified address. Best-effort and idempotent (dedupes by filters_hash) —
 * never blocks or fails sign-in.
 */
async function claimGuestSearchesForUser(user: User): Promise<void> {
  const email = user.email?.trim().toLowerCase()
  if (!email) return
  if (!user.email_confirmed_at) return // verified email only
  try {
    await claimGuestSavedSearches(user.id, email)
  } catch (err) {
    Sentry.captureException(err)
  }
}

async function getBaseUrl(request: Request): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  const { origin } = new URL(request.url)
  return (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cookieStore = await cookies()
  const nextFromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value
  const next = nextFromCookie ?? searchParams.get('next') ?? '/'
  const safeNext = safeRedirectPath(next)
  const base = await getBaseUrl(request)
  // Durable first-party visitor id (Phase 5) — present server-side so the login
  // can stitch this browser's anonymous history to the now-known person.
  const rrVid = cookieStore.get('rr_vid')?.value

  const errorParam = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')
  if (errorParam) {
    const message = errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'Sign-in failed. Please try again.'
    const res = NextResponse.redirect(`${base}/auth-error?message=${encodeURIComponent(message)}&next=${encodeURIComponent(safeNext)}`)
    res.cookies.delete(AUTH_NEXT_COOKIE)
    return res
  }

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Surface the real reason instead of the generic "Could not sign in"
      // fall-through (previously swallowed — e.g. a missing PKCE code_verifier).
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
      Sentry.captureException(error, { tags: { area: 'auth-callback' } })
    }
    if (!error && data.user) {
      const sourceUrl = `${base}${safeNext}`.replace(/\/$/, '') || base
      const name = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name
      trackSignedInUser({
        email: data.user.email ?? '',
        fullName: typeof name === 'string' ? name : undefined,
        sourceUrl,
        message: 'Signed in (Google)',
      }).catch((err) => {
        Sentry.captureException(err)
      })
      // Capture the Google/Facebook profile photo onto the CRM person.
      const avatar = data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture
      if (typeof avatar === 'string' && avatar) {
        import('@/lib/crm/mirror')
          .then(({ saveOauthAvatarByEmail }) => saveOauthAvatarByEmail(data.user.email, avatar))
          .catch(() => {})
      }
      const redirectUrl = safeNext.includes('?') ? `${base}${safeNext}&signed_up=1` : `${base}${safeNext}?signed_up=1`
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.delete(AUTH_NEXT_COOKIE)
      await stampFubCidFromEmail(res, data.user.email ?? '', rrVid, data.user.id, 'auth_oauth')
      // Phase 7.3: pull this signer's guest email-keyed saved searches into the
      // account (verified-email gated, idempotent, never blocks sign-in).
      await claimGuestSearchesForUser(data.user)
      return res
    }
  }

  if (tokenHash && (type === 'magiclink' || type === 'recovery')) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'magiclink' | 'recovery',
    })
    if (!error && data.user) {
      const sourceUrl = `${base}${safeNext}`.replace(/\/$/, '') || base
      trackSignedInUser({
        email: data.user.email ?? '',
        fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
        sourceUrl,
        message: type === 'recovery' ? 'Signed in (password reset)' : 'Signed in (email link)',
      }).catch((err) => {
        Sentry.captureException(err)
      })
      const redirectUrl = safeNext.includes('?') ? `${base}${safeNext}&signed_up=1` : `${base}${safeNext}?signed_up=1`
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.delete(AUTH_NEXT_COOKIE)
      await stampFubCidFromEmail(res, data.user.email ?? '', rrVid, data.user.id, type === 'recovery' ? 'auth_recovery' : 'auth_email')
      // Phase 7.3: pull this signer's guest email-keyed saved searches into the
      // account (verified-email gated, idempotent, never blocks sign-in).
      await claimGuestSearchesForUser(data.user)
      return res
    }
  }

  return NextResponse.redirect(`${base}/auth-error?message=${encodeURIComponent('Could not sign in')}&next=${encodeURIComponent(safeNext)}`)
}
