'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignInUrl, signInWithEmailPassword, resetPasswordForEmail } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { GoogleIcon } from '@/components/icons/AuthProviderIcons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const ADMIN_NEXT = '/admin'

export default function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleGoogle() {
    setLoading('google')
    setError(null)
    const result = await getSignInUrl('google', ADMIN_NEXT)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setError(result.error)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    setLoading('email')
    const result = await signInWithEmailPassword(email.trim(), password, { next: ADMIN_NEXT })
    setLoading(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const role = await getAdminRoleForEmail(email.trim())
    if (!role) {
      router.replace('/admin/access-denied')
      return
    }
    router.refresh()
    router.push(ADMIN_NEXT)
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    setLoading('forgot')
    const result = await resetPasswordForEmail(email.trim(), { next: ADMIN_NEXT })
    setLoading(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForgotSent(true)
  }

  if (forgotMode) {
    return (
      <div className="mt-6 space-y-4">
        {forgotSent ? (
          <>
            <p className="text-sm text-muted-foreground">
              Check your email for a reset link. Use it to set a new password; youâ€™ll then be signed in and sent to the admin.
            </p>
            <Button
              type="button"
              onClick={() => { setForgotMode(false); setForgotSent(false); setError(null) }}
              className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your admin email and weâ€™ll send a password reset link.</p>
            <div>
              <Label htmlFor="admin-forgot-email" className="block text-sm font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="admin-forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading === 'forgot'}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {loading === 'forgot' ? 'Sendingâ€¦' : 'Send reset link'}
              </Button>
              <Button
                type="button"
                onClick={() => { setForgotMode(false); setError(null) }}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <Button
        type="button"
        onClick={handleGoogle}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
      >
        <GoogleIcon className="size-5 text-primary-foreground" />
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="admin-email" className="block text-sm font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="admin-password" className="block text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
          <p className="mt-1 text-right">
            <Button
              type="button"
              onClick={() => setForgotMode(true)}
              className="text-sm text-muted-foreground hover:text-muted-foreground"
            >
              Forgot password?
            </Button>
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {loading === 'email' ? 'Signing inâ€¦' : 'Sign in with email'}
        </Button>
      </form>
    </div>
  )
}
