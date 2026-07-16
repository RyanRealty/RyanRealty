'use client'

/**
 * HeaderAccount — the site header's account control (admin rebuild RC7 fix).
 *
 * Before this, a signed-in visitor had NO path to their account from the chrome:
 * the header always rendered a static "Sign in" link and the only account menu
 * that was ever built (components/AuthDropdown.tsx) had zero importers. So people
 * who saved searches/homes couldn't get back to them — the root of "logging in and
 * saving is confusing".
 *
 * Client island (mirrors SignInPromptWithSession): fetches /api/auth/me so the
 * header shell stays statically prerenderable (no server getSession — the
 * SITE_SPEC §45-47 CDN-cache constraint). Signed-out → the existing "Sign in" CTA,
 * unchanged. Signed-in → an account menu linking to the account hub, saved
 * searches, saved homes, and sign-out.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AuthUser } from '@/app/actions/auth'
import { signOut } from '@/app/actions/auth'
import { useSessionUser } from '@/lib/hooks/useSessionUser'
import { CTAButton } from '@/components/site/primitives'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function initials(user: AuthUser): string {
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    '?'
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export default function HeaderAccount() {
  // undefined = still loading (show the safe signed-out CTA); null = signed out.
  const fetched = useSessionUser()
  const [signedOut, setSignedOut] = useState(false)
  const user = signedOut ? null : fetched
  const router = useRouter()

  // Loading or signed out → the existing Sign in CTA (unchanged behavior).
  if (!user) {
    return (
      <CTAButton href="/login" tone="on-navy-ghost" size="md" className="hidden whitespace-nowrap sm:inline-flex">
        Sign in
      </CTAButton>
    )
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Account'

  async function handleSignOut() {
    await signOut()
    setSignedOut(true)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {initials(user)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">My account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/saved-searches">Saved searches</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/saved-homes">Saved homes</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handleSignOut() }}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
