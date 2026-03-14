'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { trackSignedInUser } from '@/lib/followupboss'

const AUTH_NEXT_COOKIE = 'auth_next'

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

export async function getSession(): Promise<{ user: AuthUser } | null> {
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
}

/** Return path cookie: 10 min, httpOnly, so OAuth redirect brings user back to the page they signed in from. */
export async function getSignInUrl(provider: 'google' | 'facebook' | 'apple', next = '/'): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const cookieStore = await cookies()
  const safeNext = next.startsWith('/') ? next : `/${next}`
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
    const safeNext = options.next.startsWith('/') ? options.next : `/${options.next}`
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
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const sourceUrl = options?.sourceUrl || base
  await trackSignedInUser({
    email: data.user.email,
    fullName: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    sourceUrl,
    message: 'Signed in (email)',
  }).catch(() => {})
  const next = cookieStore.get(AUTH_NEXT_COOKIE)?.value || '/'
  return { ok: true, next: next.startsWith('/') ? next : `/${next}` }
}

/** Sign up with email and password. Tracks user in FollowUp Boss (create or merge by email). */
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  options?: { fullName?: string; next?: string; sourceUrl?: string }
): Promise<{ ok: true; next?: string } | { ok: false; error: string }> {
  const cookieStore = await cookies()
  if (options?.next) {
    const safeNext = options.next.startsWith('/') ? options.next : `/${options.next}`
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
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const sourceUrl = options?.sourceUrl || base
  await trackSignedInUser({
    email: data.user.email,
    fullName: options?.fullName ?? data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    sourceUrl,
    message: 'Signed up (email)',
  }).catch(() => {})
  const next = cookieStore.get(AUTH_NEXT_COOKIE)?.value || '/'
  return { ok: true, next: next.startsWith('/') ? next : `/${next}` }
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
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const next = options?.next?.startsWith('/') ? options.next : '/dashboard/settings'
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

