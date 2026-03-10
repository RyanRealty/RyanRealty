import { createServerClient } from '@/lib/supabase'
import { trackSignedInUser } from '@/lib/followupboss'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const AUTH_NEXT_COOKIE = 'auth_next'

function getBaseUrl(origin: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin
  return base.replace(/\/$/, '') || origin
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const cookieStore = await cookies()
  const nextFromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value
  const next = nextFromCookie ?? searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') ? next : `/${next}`
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

  const supabase = await createServerClient()

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
      }).catch(() => {})
      const redirectUrl = safeNext.includes('?') ? `${base}${safeNext}&signed_up=1` : `${base}${safeNext}?signed_up=1`
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.delete(AUTH_NEXT_COOKIE)
      return res
    }
  }

  if (tokenHash && type === 'magiclink') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (!error && data.user) {
      const sourceUrl = `${base}${safeNext}`.replace(/\/$/, '') || base
      trackSignedInUser({
        email: data.user.email ?? '',
        fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
        sourceUrl,
        message: 'Signed in (email link)',
      }).catch(() => {})
      const redirectUrl = safeNext.includes('?') ? `${base}${safeNext}&signed_up=1` : `${base}${safeNext}?signed_up=1`
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.delete(AUTH_NEXT_COOKIE)
      return res
    }
  }

  return NextResponse.redirect(`${base}/auth-error?message=${encodeURIComponent('Could not sign in')}&next=${encodeURIComponent(safeNext)}`)
}
