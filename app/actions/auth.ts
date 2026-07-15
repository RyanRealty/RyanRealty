'use server'

import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'
import { createClient } from '@/lib/supabase/server'
import { trackSignedInUser } from '@/lib/followupboss'

const AUTH_NEXT_COOKIE = 'auth_next'

/**
 * Build the base URL from the INCOMING REQUEST origin (not the static NEXT_PUBLIC_SITE_URL).
 * The PKCE code_verifier cookie is set on whatever domain the user is on; if redirectTo points
 * at a different host (e.g. the vercel.app deployment URL), GoTrue returns the user to that other
 * host where the cookie isn't sent, the token exchange has no verifier, and sign-in fails with
 * "Could not sign in". Deriving the base from the request keeps the cookie and the callback on the
 * same domain (ryan-realty.com in prod, localhost in dev, the preview host on previews).
 * Falls back to NEXT_PUBLIC_SITE_URL only when request headers are unavailable.
 */
async function getRequestBaseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
}

export type AuthUser = {
  id: string
  email?: string | null
  /** Normalized from user_metadata and identities so Google/profile picture always works. */
  avatar_url?: string | null
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string }
}

function normalizeAvatarUrl(user: { user_metadata?: Record<string, unknown>; identities?: Array<{ identity_data?: Record<string, unknown> }> }): string | null {
  const fromMeta = user.user_metadata?.avatar_url ?? user.user_metadata?.picture
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta
  const fromIdentity = user.identities?.[0]?.identity_data?.avatar_url ?? user.identities?.[0]?.identity_data?.picture
  if (typeof fromIdentity === 'string' && fromIdentity) return fromIdentity
  return null
}

// Request-memoized: hot admin pages resolve the session from several data
// loaders in one render (page + actions + DAL guards), and each call was a
// full GoTrue network round trip. React cache() dedupes within one request;
// the exported symbol stays a plain async function as 'use server' requires.
const resolveSession = cache(async (): Promise<{ user: AuthUser } | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const avatar_url = normalizeAvatarUrl(user)
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      avatar_url: avatar_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      user_metadata: user.user_metadata,
    },
  }
})

export async function getSession(): Promise<{ user: AuthUser } | null> {
  return resolveSession()
}

/** Return path cookie: 10 min, httpOnly, so OAuth redirect brings user back to the page they signed in from. */
export async function getSignInUrl(provider: 'google' | 'facebook' | 'apple', next = '/'): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const base = await getRequestBaseUrl()
  const cookieStore = await cookies()
  const safeNext = safeRedirectPath(next)
  cookieStore.set(AUTH_NEXT_COOKIE, safeNext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${base}/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'No redirect URL' }
  return { url: data.url }
}

/** Sign in with email and password. Tracks user in FollowUp Boss (create or merge by email). */
export async function signInWithEmailPassword(
  email: string,
  password: string,
  options?: { next?: string; sourceUrl?: string }
): Promise<{ ok: true; next?: string } | { ok: false; error: string }> {
  const cookieStore = await cookies()
  if (options?.next) {
    const safeNext = safeRedirectPath(options.next)
    cookieStore.set(AUTH_NEXT_COOKIE, safeNext, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    })
  }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) return { ok: false, error: error.message }
  if (!data.user?.email) return { ok: false, error: 'Sign-in failed' }
  const base = await getRequestBaseUrl()
  const sourceUrl = options?.sourceUrl || base
  await trackSignedInUser({
    email: data.user.email,
    fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    sourceUrl,
    message: 'Signed in (email)',
  }).catch(() => {})
  return { ok: true, next: safeRedirectPath(cookieStore.get(AUTH_NEXT_COOKIE)?.value) }
}

/** Sign up with email and password. Tracks user in FollowUp Boss (create or merge by email). */
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  options?: { fullName?: string; next?: string; sourceUrl?: string }
): Promise<{ ok: true; next?: string; needsConfirmation?: boolean } | { ok: false; error: string }> {
  const cookieStore = await cookies()
  if (options?.next) {
    const safeNext = safeRedirectPath(options.next)
    cookieStore.set(AUTH_NEXT_COOKIE, safeNext, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    })
  }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: options?.fullName ? { data: { full_name: options.fullName } } : undefined,
  })
  if (error) return { ok: false, error: error.message }
  if (!data.user?.email) return { ok: false, error: 'Sign-up failed' }
  const base = await getRequestBaseUrl()
  const sourceUrl = options?.sourceUrl || base
  await trackSignedInUser({
    email: data.user.email,
    fullName: options?.fullName ?? data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    sourceUrl,
    message: 'Signed up (email)',
  }).catch(() => {})
  // Supabase returns a user WITHOUT a session when email confirmation is
  // required (the hosted default) and for the obfuscated existing-email
  // response. The client used to treat every ok:true as a live session and
  // hard-redirect — the new user landed on the homepage, signed out, with
  // zero feedback (design-audit P1). Surface the state instead.
  if (!data.session) {
    return { ok: true, needsConfirmation: true }
  }
  return { ok: true, next: safeRedirectPath(cookieStore.get(AUTH_NEXT_COOKIE)?.value) }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

/** Send password reset email. Optional next = redirect path after reset (e.g. '/admin'). */
export async function resetPasswordForEmail(
  email: string,
  options?: { next?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const base = await getRequestBaseUrl()
  const next = safeRedirectPath(options?.next, '/dashboard/settings')
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

