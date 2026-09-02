'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signUpWithEmailPassword } from '@/app/actions/auth'
import { signInWithOAuthBrowser } from '@/lib/supabase/oauth'
import { FacebookIcon } from '@/components/icons/AuthProviderIcons'
import { GoogleCommsCard, GoogleContinueButton, useGoogleCommsConsent } from '@/components/auth/GoogleCommsCard'
import GoogleOneTap from '@/components/auth/GoogleOneTap'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/PasswordInput'

type Props = { next: string; googleClientId?: string | null }

export default function SignupForm({ next, googleClientId = null }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const comms = useGoogleCommsConsent()

  if (needsConfirmation) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-base font-semibold text-foreground">Check your email</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{email.trim()}</span>.
          Click it to activate your account, then sign in.
        </p>
      </div>
    )
  }

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

  // One Tap / GIS button path — same signInWithIdToken contract as the login
  // page and the save-gate modal; Supabase creates the account on first
  // sign-in, so the post-auth redirect matches handleSubmit's success path.
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
    else window.location.href = '/account?welcome=1'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading('email')
    const result = await signUpWithEmailPassword(email.trim(), password, {
      fullName: fullName.trim() || undefined,
      next,
    })
    setLoading(null)
    if (result.ok) {
      // No live session yet (email confirmation required, the hosted default):
      // redirecting would land the user on the homepage signed-out with zero
      // feedback (design-audit P1). Show the check-your-email state instead.
      if (result.needsConfirmation) {
        setNeedsConfirmation(true)
        return
      }
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      else window.location.href = '/account?welcome=1'
      return
    }
    setError(result.error)
  }

  return (
    <div className="mt-6 space-y-4">
      <GoogleCommsCard consent={comms.consent} onChange={comms.setConsent} />
      {/* Google's own rendered button (GIS) when a client id is configured.
          Falls back to the redirect-based button only when GIS has no
          client id. */}
      {googleClientId ? (
        <GoogleOneTap clientId={googleClientId} onCredential={handleGoogleCredential} />
      ) : (
        <GoogleContinueButton
          loading={loading === 'google'}
          disabled={!!loading}
          onClick={() => handleOAuth('google')}
          variant="outline"
          className="w-full"
        />
      )}
      <Button
        type="button"
        onClick={() => handleOAuth('facebook')}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
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
          <Label htmlFor="signup-name" className="block text-sm font-medium text-muted-foreground">
            Full name (optional)
          </Label>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="signup-email" className="block text-sm font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="signup-password" className="block text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">At least 6 characters</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading === 'email' ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to the{' '}
          <a href="/terms" className="underline underline-offset-2">Terms of Service</a> and{' '}
          <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
        </p>
      </form>
    </div>
  )
}
