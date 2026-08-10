'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BellAlertIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import {
  dismissGuestWatch,
  readGuestWatch,
  shouldShowGuestWatchBanner,
  type GuestWatchResidual,
} from '@/lib/alerts/guest-watch-residual'

/**
 * F2 guest habit residual — soft return banner.
 *
 * After a guest sets a listing alert, we store only a short label + relative
 * browse href in localStorage (no email/token). On a later visit this banner
 * reminds them they are watching that search and points them to:
 *   1. matching homes (the search they saved)
 *   2. free account (full manage feed)
 *   3. email manage/pause (token already in alert emails — we never invent one)
 *
 * Not creepy: first-party product preference only, dismissible, no server sync.
 */

function pathHidesBanner(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname.startsWith('/lp/')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/sign/')) return true
  if (pathname.startsWith('/account')) return true
  if (pathname.startsWith('/dashboard')) return true
  if (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password') return true
  if (pathname.startsWith('/alerts/')) return true
  if (pathname.startsWith('/newsletter/')) return true
  // Search surfaces already show the sticky residual strip (SearchAlertCapture).
  if (pathname === '/search' || pathname.startsWith('/search/')) return true
  if (pathname.startsWith('/homes-for-sale')) return true
  return false
}

export default function GuestWatchingBanner() {
  const pathname = usePathname()
  const [residual, setResidual] = useState<GuestWatchResidual | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    // Auth: signed-in users already have /account ActivityFeed (F2 signed-in path).
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: { id?: string } | null } | null) => {
        if (!active) return
        if (data?.user?.id) {
          setSignedIn(true)
          setReady(true)
          return
        }
        setSignedIn(false)
        if (shouldShowGuestWatchBanner()) {
          setResidual(readGuestWatch())
        } else {
          setResidual(null)
        }
        setReady(true)
      })
      .catch(() => {
        if (!active) return
        // Network blip: still allow residual for guests.
        if (shouldShowGuestWatchBanner()) setResidual(readGuestWatch())
        setReady(true)
      })
    return () => {
      active = false
    }
  }, [pathname])

  if (!ready || signedIn || !residual) return null
  if (pathHidesBanner(pathname)) return null

  function dismiss() {
    dismissGuestWatch()
    setResidual(null)
  }

  const signupHref = `/signup?next=${encodeURIComponent('/account/saved-searches')}`

  return (
    <div
      role="region"
      aria-label="Your listing alerts"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4"
    >
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2 border-2 border-primary bg-card px-3 py-2.5 text-foreground shadow-md sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
          <BellAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" aria-hidden />
          <div className="min-w-0 text-sm leading-snug">
            <p className="font-medium">
              You&apos;re watching{' '}
              <span className="text-primary">{residual.label}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              New matches go to the email you used.{' '}
              <span className="hidden sm:inline">
                Pause anytime from the link in any alert email.
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href={residual.href}
            className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90"
          >
            See homes
          </Link>
          <Link
            href={signupHref}
            className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-primary underline-offset-2 hover:underline sm:text-sm"
          >
            Manage in account
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="min-h-11 min-w-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            aria-label="Dismiss watching reminder"
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
