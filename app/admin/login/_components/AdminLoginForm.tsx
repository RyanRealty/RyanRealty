'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import { isSafeAdminReturnPath } from '@/lib/auth/admin-return-path'
import { GoogleIcon } from '@/components/icons/AuthProviderIcons'
import { Button } from '@/components/admin/v2'

const ADMIN_NEXT = '/admin'

/**
 * GIS / OAuth hosted-domain hint. Matches the @ryan-realty.com copy on this
 * page and the existing admin_roles / access-denied gate. Google treats `hd`
 * as a hint, not an authorization check — the server gate still rejects
 * non-brokerage accounts.
 */
const ADMIN_GOOGLE_HOSTED_DOMAIN = 'ryan-realty.com'

/**
 * Google-only admin sign-in (Matt directive 2026-06-09: the brokerage runs on
 * Google Workspace). Updated 2026-06-15 to lead with Google One Tap / FedCM —
 * the modern "one click on your avatar" prompt the way most sites do it — using
 * Supabase signInWithIdToken. Facebook was removed from the auth path entirely.
 *
 * One Tap shows the signed-in Google account (avatar + name) as a single-click
 * prompt and renders a personalized "Continue as <name>" button. The full
 * redirect flow stays as a fallback for browsers that suppress One Tap (FedCM
 * disabled, third-party-cookie edge cases) or when no client id is configured.
 *
 * GIS initialize and the OAuth fallback pass `hd=ryan-realty.com` so Chrome's
 * last Gmail session is not offered first when a Workspace account is present
 * (or so the account chooser opens instead of a consumer chip).
 *
 * Requires the site origin under "Authorized JavaScript origins" on the Google
 * OAuth web client (GOOGLE_OAUTH_CLIENT_ID) — One Tap will not render otherwise.
 *
 * 11F: presentation migrated to the LOCKED admin v2 language (ADMIN_UI.md).
 * The handlers, nonce/PKCE flow, next= destination, and domain gate are
 * unchanged except for the `hd` hosted-domain hint on GIS + OAuth.
 */

interface GoogleIdConfig {
  client_id: string
  callback: (resp: { credential: string }) => void
  nonce?: string
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  use_fedcm_for_prompt?: boolean
  /** Workspace domain hint — limits One Tap / button account selection. */
  hd?: string
}
interface GoogleButtonOptions {
  type?: string
  theme?: string
  size?: string
  text?: string
  shape?: string
  logo_alignment?: string
  width?: number
}
interface GisGoogle {
  accounts: {
    id: {
      initialize: (c: GoogleIdConfig) => void
      renderButton: (el: HTMLElement, o: GoogleButtonOptions) => void
      prompt: () => void
      cancel: () => void
    }
  }
}

// Access the GIS global without augmenting Window.google (which is already typed
// as the Google Maps namespace elsewhere — augmenting it collides). Cast through
// unknown so the two unrelated `google` shapes don't conflict.
function gis(): GisGoogle | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { google?: GisGoogle }).google
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gis()?.accounts?.id) return resolve()
    const existing = document.getElementById('google-gsi-client') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gsi load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.id = 'google-gsi-client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi load failed'))
    document.head.appendChild(s)
  })
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function AdminLoginForm({ googleClientId, next }: { googleClientId: string | null; next?: string }) {
  const router = useRouter()
  // Preserve the deep-link destination through auth (RC5 fix): a broker who taps an
  // SMS/notification link to a lead with an expired session lands BACK on that lead
  // after signing in, instead of being dumped on the dashboard. Falls back to /admin.
  const dest = next && isSafeAdminReturnPath(next) ? next : ADMIN_NEXT
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const onCredential = useCallback(
    async (rawNonce: string, credential: string) => {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: rawNonce })
      if (error) {
        setLoading(false)
        setError(error.message)
        return
      }
      router.push(dest)
      router.refresh()
    },
    [router, dest],
  )

  useEffect(() => {
    if (!googleClientId) return
    let cancelled = false
    ;(async () => {
      const rawNonce = crypto.randomUUID()
      const hashedNonce = await sha256Hex(rawNonce)
      try {
        await loadGis()
      } catch {
        return // fallback button still works
      }
      const g = gis()
      if (cancelled || !g) return
      g.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp) => onCredential(rawNonce, resp.credential),
        nonce: hashedNonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        hd: ADMIN_GOOGLE_HOSTED_DOMAIN,
      })
      if (buttonRef.current) {
        g.accounts.id.renderButton(buttonRef.current, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: 320,
        })
      }
      g.accounts.id.prompt() // the avatar One Tap prompt
    })()
    return () => {
      cancelled = true
      try { gis()?.accounts.id.cancel() } catch { /* noop */ }
    }
  }, [googleClientId, onCredential])

  async function handleRedirect() {
    setLoading(true)
    setError(null)
    const result = await signInWithOAuthBrowser('google', dest, { hd: ADMIN_GOOGLE_HOSTED_DOMAIN })
    if (result.error) {
      setLoading(false)
      setError(result.error)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {googleClientId ? (
        <>
          {/* One Tap renders its personalized "Continue as <name>" button here */}
          <div ref={buttonRef} className="flex min-h-11 justify-center" />
          {/* Secondary path when One Tap can't auto-detect the account */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="quiet"
              onClick={handleRedirect}
              disabled={loading}
              style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
            >
              {loading ? 'Signing in…' : 'Sign in with a different account'}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          onClick={handleRedirect}
          disabled={loading}
          className="w-full gap-3"
        >
          <GoogleIcon className="size-5" />
          {loading ? 'Signing in…' : 'Continue with Google'}
        </Button>
      )}

      <p className="text-center" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        Use your @ryan-realty.com Google account.
      </p>
      {error && (
        <p className="text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
