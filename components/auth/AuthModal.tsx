'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignInUrl, signInWithEmailPassword, signUpWithEmailPassword } from '@/app/actions/auth'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  onClose: () => void
  /** After auth, run this (e.g. retry save). */
  onSuccess?: () => void
  next?: string
}

export default function AuthModal({ open, onClose, onSuccess, next = '/dashboard' }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  async function handleGoogle() {
    setLoading('google')
    setError(null)
    const result = await getSignInUrl('google', next)
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setError(result.error)
  }

  async function handleEmailSignIn(e: React.FormEvent) {
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
      onClose()
      router.refresh()
      onSuccess?.()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setError(result.error)
  }

  async function handleEmailSignUp(e: React.FormEvent) {
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
      onClose()
      router.refresh()
      onSuccess?.()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setError(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ryan Realty</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 border-b border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setTab('signin'); setError(null) }}
            className={`border-b-2 rounded-none px-3 py-2 text-sm font-medium ${
              tab === 'signin'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setTab('signup'); setError(null) }}
            className={`border-b-2 rounded-none px-3 py-2 text-sm font-medium ${
              tab === 'signup'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Create account
          </Button>
        </div>
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={!!loading}
            className="w-full"
          >
            {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          <div className="border-t border-border" />
          {tab === 'signin' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={!!loading} className="w-full">
                {loading === 'email' ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-3">
              <Input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password (min 6)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={!!loading} className="w-full">
                {loading === 'email' ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
