import { createClient } from '@/lib/supabase/server'
import { trackSignedInUser } from '@/lib/followupboss'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const AUTH_NEXT_COOKIE = 'auth_next'

function getBaseUrl(origin: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin
  return base.replace(/\/$/, '') || origin
}

/** Ensure redirect target is a same-origin path (no protocol-relative or double slash). */
function safeRedirectPath(next: string): string {
  const withLeading = next.startsWith('/') ? next : `/${next}`
  return withLeading.replace(/\/\/+/g, '/')
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const cookieStore = await cookies()
  const nextFromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value
  const next = nextFromCookie ?? searchParams.get('next') ?? '/'
  const safeNext = safeRedirectPath(next)
  const base = getBaseUrl(origin)

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
      const redirectUrl = safeNext.includes('?') ? `${base}${safeNext}&signed_up=1` : `${base}${safeNext}?signed_up=1`
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.delete(AUTH_NEXT_COOKIE)
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
      return res
    }
  }

  return NextResponse.redirect(`${base}/auth-error?message=${encodeURIComponent('Could not sign in')}&next=${encodeURIComponent(safeNext)}`)
}
