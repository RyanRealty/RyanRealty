'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignInUrl, signUpWithEmailPassword } from '@/app/actions/auth'
import { GoogleIcon, FacebookIcon } from '@/components/icons/AuthProviderIcons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = { next: string }

export default function SignupForm({ next }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleOAuth(provider: 'google' | 'facebook') {
    setLoading(provider)
    setError(null)
    const result = await getSignInUrl(provider, next)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setError(result.error)
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
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      else window.location.href = '/dashboard?welcome=1'
      return
    }
    setError(result.error)
  }

  return (
    <div className="mt-6 space-y-4">
      <Button
        type="button"
        onClick={() => handleOAuth('google')}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        <GoogleIcon className="size-5" />
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </Button>
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
            Full name
          </Label>
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
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
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="signup-password" className="block text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
          <p className="mt-0.5 text-xs text-muted-foreground">At least 6 characters</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {loading === 'email' ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </div>
  )
}
