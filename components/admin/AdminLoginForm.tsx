'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import { GoogleIcon } from '@/components/icons/AuthProviderIcons'
import { Button } from '@/components/ui/button'

const ADMIN_NEXT = '/admin'

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
 * Requires the site origin under "Authorized JavaScript origins" on the Google
 * OAuth web client (GOOGLE_OAUTH_CLIENT_ID) — One Tap will not render otherwise.
 */

interface GoogleIdConfig {
  client_id: string
  callback: (resp: { credential: string }) => void
  nonce?: string
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  use_fedcm_for_prompt?: boolean
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

export default function AdminLoginForm({ googleClientId }: { googleClientId: string | null }) {
  const router = useRouter()
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
      router.push(ADMIN_NEXT)
      router.refresh()
    },
    [router],
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
    const result = await signInWithOAuthBrowser('google', ADMIN_NEXT)
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
          <div ref={buttonRef} className="flex min-h-[44px] justify-center" />
          {/* Secondary path when One Tap can't auto-detect the account */}
          <Button
            type="button"
            variant="link"
            onClick={handleRedirect}
            disabled={loading}
            className="mx-auto block h-auto text-xs text-muted-foreground hover:text-foreground"
          >
            {loading ? 'Signing in…' : 'Sign in with a different account'}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleRedirect}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
        >
          <GoogleIcon className="size-5" />
          {loading ? 'Signing in…' : 'Continue with Google'}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">Use your @ryan-realty.com Google account.</p>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  )
}
