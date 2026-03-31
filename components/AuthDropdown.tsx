'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { getSignInUrl, signInWithEmailPassword, signUpWithEmailPassword, signOut } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type Props = { user: AuthUser | null }

export default function AuthDropdown({ user }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [mode, setMode] = useState<'choose' | 'signin' | 'signup'>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  function getNext(): string {
    const fromQuery = searchParams.get('next')
    const fromPath = pathname && pathname !== '/' ? pathname : '/'
    const search = typeof window !== 'undefined' ? window.location.search : ''
    return fromQuery || (fromPath !== '/' ? `${fromPath}${search}` : fromPath)
  }

  async function handleSignInGoogle() {
    setLoading('google')
    const result = await getSignInUrl('google', getNext())
    setLoading(null)
    if ('url' in result) window.location.href = result.url
    else setOpen(false)
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!email.trim()) {
      setEmailError('Enter your email')
      return
    }
    if (!password) {
      setEmailError('Enter your password')
      return
    }
    setLoading('email')
    const result = await signInWithEmailPassword(email.trim(), password, { next: getNext() })
    setLoading(null)
    if (result.ok) {
      setOpen(false)
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setEmailError(result.error)
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!email.trim()) {
      setEmailError('Enter your email')
      return
    }
    if (password.length < 6) {
      setEmailError('Password must be at least 6 characters')
      return
    }
    setLoading('email')
    const result = await signUpWithEmailPassword(email.trim(), password, { fullName: fullName.trim() || undefined, next: getNext() })
    setLoading(null)
    if (result.ok) {
      setOpen(false)
      router.refresh()
      if (result.next && result.next !== '/') window.location.href = result.next
      return
    }
    setEmailError(result.error)
  }

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    router.refresh()
    window.location.href = '/'
  }

  if (user) {
    const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? 'there'
    const avatarUrl = user.avatar_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture
    return (
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Account menu"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-border text-xs font-semibold text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="hidden sm:inline">Welcome, {displayName.split(/\s+/)[0]}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" />
        </Button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-card py-2 shadow-md">
              <p className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">Account</p>
              <Link
                href="/account"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/account/profile"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/account/saved-searches"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Saved searches
              </Link>
              <Link
                href="/account/saved-homes"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Saved homes
              </Link>
              <Link
                href="/account/saved-communities"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Saved communities
              </Link>
              <Link
                href="/account/buying-preferences"
                className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Buying preferences
              </Link>
              <Separator className="mt-1" />
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  Sign out
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        type="button"
        onClick={() => { setOpen((o) => !o); setMode('choose'); setEmailError(null); }}
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Sign in
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-border bg-card py-2 shadow-md">
            {mode === 'choose' && (
              <>
                <p className="px-4 py-1 text-xs text-muted-foreground">Sign in with</p>
                <Button
                  type="button"
                  disabled={!!loading}
                  onClick={handleSignInGoogle}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {loading === 'google' ? '…' : 'Google'}
                </Button>
                <Separator className="my-2" />
                <Button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  Email and password
                </Button>
                <Button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="w-full px-4 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                >
                  Create account
                </Button>
              </>
            )}
            {(mode === 'signin' || mode === 'signup') && (
              <form
                onSubmit={mode === 'signup' ? handleEmailSignUp : handleEmailSignIn}
                className="px-4 py-2 space-y-2"
              >
                <Button type="button" onClick={() => { setMode('choose'); setEmailError(null); }} className="text-xs text-muted-foreground hover:text-muted-foreground">
                  â† Back
                </Button>
                {mode === 'signup' && (
                  <Input
                    type="text"
                    placeholder="Name (optional)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-foreground"
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-foreground"
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder={mode === 'signup' ? 'Password (min 6)' : 'Password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setEmailError(null); }}
                  className="w-full rounded-lg border border-primary/20 px-3 py-2 text-sm text-foreground"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                <Button
                  type="submit"
                  disabled={!!loading}
                  className="w-full rounded-lg bg-foreground py-2 text-sm font-medium text-primary-foreground hover:bg-muted-foreground disabled:opacity-50"
                >
                  {loading === 'email' ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
