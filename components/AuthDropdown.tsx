'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { getSignInUrl, signInWithEmailPassword, signUpWithEmailPassword, signOut } from '@/app/actions/auth'
import type { AuthUser } from '@/app/actions/auth'

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
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
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
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="hidden sm:inline">Welcome, {displayName.split(/\s+/)[0]}</span>
          <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
              <p className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">Account</p>
              <Link
                href="/account"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/account/profile"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/account/saved-searches"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Saved searches
              </Link>
              <Link
                href="/account/saved-homes"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Saved homes
              </Link>
              <Link
                href="/account/saved-communities"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Saved communities
              </Link>
              <Link
                href="/account/buying-preferences"
                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Buying preferences
              </Link>
              <div className="mt-1 border-t border-zinc-100 pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setMode('choose'); setEmailError(null); }}
        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Sign in
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-[280px] rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
            {mode === 'choose' && (
              <>
                <p className="px-4 py-1 text-xs text-zinc-500">Sign in with</p>
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={handleSignInGoogle}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {loading === 'google' ? '…' : 'Google'}
                </button>
                <div className="my-2 border-t border-zinc-100" />
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Email and password
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="w-full px-4 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  Create account
                </button>
              </>
            )}
            {(mode === 'signin' || mode === 'signup') && (
              <form
                onSubmit={mode === 'signup' ? handleEmailSignUp : handleEmailSignIn}
                className="px-4 py-2 space-y-2"
              >
                <button type="button" onClick={() => { setMode('choose'); setEmailError(null); }} className="text-xs text-zinc-500 hover:text-zinc-700">
                  ← Back
                </button>
                {mode === 'signup' && (
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder={mode === 'signup' ? 'Password (min 6)' : 'Password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setEmailError(null); }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                <button
                  type="submit"
                  disabled={!!loading}
                  className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading === 'email' ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
