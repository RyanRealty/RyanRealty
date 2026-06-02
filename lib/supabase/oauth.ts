'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Initiate OAuth sign-in FROM THE BROWSER.
 *
 * Why client-side and not the `getSignInUrl` server action: with @supabase/ssr
 * (PKCE default), signInWithOAuth generates a `code_verifier` that must be
 * stored as a cookie and read back by /auth/callback's exchangeCodeForSession.
 * When OAuth was initiated in a server action, that verifier cookie did not
 * survive to the callback, so the exchange failed locally (no POST /token) and
 * the flow fell through to "Could not sign in" — and no FUB lead was created.
 *
 * Initiating here means the browser client writes the verifier cookie via the
 * same cookie mechanism the server callback reads, on the SAME host the visitor
 * is on (window.location.origin), so there's no server-action cookie-write
 * fragility and no cross-domain verifier loss. supabase-js auto-redirects the
 * browser to the provider; on error we return it so the caller can surface it.
 *
 * `next` is passed via the redirectTo query param (the callback reads it) since
 * the old server-set auth_next cookie is no longer in play.
 */
export async function signInWithOAuthBrowser(
  provider: 'google' | 'facebook' | 'apple',
  next = '/',
): Promise<{ error?: string }> {
  const supabase = createClient()
  const safeNext = next.startsWith('/') ? next : `/${next}`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
  })
  if (error) return { error: error.message }
  // On success supabase-js navigates the browser to the provider; nothing else.
  return {}
}
