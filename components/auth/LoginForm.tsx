'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signInWithEmailPassword } from '@/app/actions/auth'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import { FacebookIcon } from '@/components/icons/AuthProviderIcons'
import { GoogleCommsCard, GoogleContinueButton, useGoogleCommsConsent } from '@/components/auth/GoogleCommsCard'
import GoogleOneTap from '@/components/auth/GoogleOneTap'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/PasswordInput'

type Props = { next: string; googleClientId?: string | null }

export default function LoginForm({ next, googleClientId = null }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const comms = useGoogleCommsConsent()

  async function handleOAuth(provider: 'google' | 'facebook') {
    setLoading(provider)
    setError(null)
    await comms.persist()
    const result = await signInWithOAuthBrowser(provider, next)
    if (result.error) {
      setLoading(null)
      setError(result.error)
    }
  }

  // One Tap / GIS button path — same signInWithIdToken contract as the
  // save-gate modal and the admin door, same post-login redirect as the
  // email/password submit below.
  async function handleGoogleCredential(rawNonce: string, credential: string) {
    setLoading('google')
    setError(null)
    await comms.persist()
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
      nonce: rawNonce,
    })
    if (error) {
      setLoading(null)
      setError(error.message)
      return
    }
    router.refresh()
    if (next && next !== '/') window.location.href = next
    else router.push('/account')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    setLoading('email')
    const result = await signInWithEmailPassword(email.trim(), password, { next })
    setLoading(null)
    if (result.ok) {
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      else router.push('/account')
      return
    }
    setError(result.error)
  }

  return (
    <div className="mt-6 space-y-4">
      <GoogleCommsCard consent={comms.consent} onChange={comms.setConsent} />
      {/* Google's own rendered button (GIS) when a client id is configured —
          the native "Continue as <name>" chip prompts alongside it for a
          visitor already signed in with Google in this browser. Falls back to the redirect-based button
          when GIS has no client id or never sizes its control. */}
      <GoogleOneTap
        clientId={googleClientId}
        onCredential={handleGoogleCredential}
        prompt
        fallback={
          <GoogleContinueButton
            loading={loading === 'google'}
            disabled={!!loading}
            onClick={() => handleOAuth('google')}
            variant="outline"
            className="w-full"
          />
        }
      />
      <Button
        type="button"
        onClick={() => handleOAuth('facebook')}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <FacebookIcon className="size-5" />
        {loading === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="login-email" className="block text-sm font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="login-password" className="block text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
          <p className="mt-1 text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-accent-foreground hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'email' ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
