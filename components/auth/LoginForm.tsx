'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSignInUrl, signInWithEmailPassword } from '@/app/actions/auth'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = { next: string }

export default function LoginForm({ next }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleGoogle() {
    setLoading('google')
    setError(null)
    const result = await getSignInUrl('google', next)
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
    const result = await signInWithEmailPassword(email.trim(), password, { next })
    setLoading(null)
    if (result.ok) {
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      else router.push('/dashboard')
      return
    }
    setError(result.error)
  }

  return (
    <div className="mt-6 space-y-4">
      <Button
        type="button"
        onClick={handleGoogle}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
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
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <Label htmlFor="login-password" className="block text-sm font-medium text-muted-foreground">
            Password
          </Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
          <p className="mt-1 text-right">
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-muted-foreground">
              Forgot password?
            </Link>
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {loading === 'email' ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
