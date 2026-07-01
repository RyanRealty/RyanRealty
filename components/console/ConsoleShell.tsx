'use client'

/**
 * ConsoleShell — the clean neutral admin chrome (Linear/Notion register) that
 * hosts the WHOLE admin. Matt directive 2026-06-15: "we do not need to enforce
 * the styles from our brand in the admin, it just needs to be ultra intuitive."
 *
 * Renders the full role-based admin nav (AdminNavList + buildAdminNav — the same
 * single nav source the brand sidebar used) inside a neutral shell: a sticky left
 * rail on desktop, a sticky top bar with a ⌘K palette, and a hamburger sheet on
 * phones. Colors come from the .console-root neutral token scope, so every page
 * rendered inside inherits the neutral look via its semantic token classes.
 */

import Link from 'next/link'
import { useState, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'
import AdminNavList from '@/app/components/admin/AdminNavList'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import ConsoleCommandPalette from '@/components/console/ConsoleCommandPalette'
import ConsoleQuickAction from '@/components/console/ConsoleQuickAction'
import CrmMobileTabBar from '@/components/console/CrmMobileTabBar'
import ConsoleTopNav from '@/components/console/ConsoleTopNav'
import TopBarScope from '@/components/console/TopBarScope'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

function Wordmark() {
  return (
    <Link href="/admin" className="flex items-center px-1" aria-label="Ryan Realty">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brand/logo-horizontal-navy-transparent.png" alt="Ryan Realty" className="h-7 w-auto" />
    </Link>
  )
}

export default function ConsoleShell({
  user,
  brokerLabel,
  brokerSlug,
  navSections,
  inboxUnread = 0,
  children,
}: {
  user: { email: string; fullName: string | null; avatarUrl: string | null }
  brokerLabel: string
  brokerSlug?: string | null
  navSections: AdminNavSection[]
  inboxUnread?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const initials = (user.fullName ?? user.email ?? '?').trim().charAt(0).toUpperCase()
  const pathname = usePathname() ?? ''
  // The FUB scope switcher is meaningful only on the contacts list, where the
  // ?broker= param drives the feed. Elsewhere the wordmark shows.
  const onContactsList = pathname === '/admin/crm'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Desktop: FUB-style dark horizontal top nav (lg+) */}
      <ConsoleTopNav sections={navSections} user={user} />

      {/* Mobile / tablet header (< lg) — hamburger + logo + search + avatar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="h-10 w-10 p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </Button>
        {/* §23.2b (mob-44): wordmark centered between hamburger and the
            search/avatar cluster. The contacts list swaps in the scope picker. */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {onContactsList ? (
            <Suspense fallback={<Wordmark />}>
              <TopBarScope myBrokerSlug={brokerSlug ?? null} />
            </Suspense>
          ) : (
            <Wordmark />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ConsoleCommandPalette />
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" title={brokerLabel} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span title={brokerLabel} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</span>
          )}
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-7 lg:px-8 lg:pb-8">{children}</main>

      {/* Global "+" quick-action FAB — rides every console surface, context-aware on a lead.
          Lifted above the mobile tab bar on phones. */}
      <ConsoleQuickAction />

      {/* FUB-style bottom tab bar — phones only (desktop rail covers nav at lg+) */}
      <CrmMobileTabBar inboxUnread={inboxUnread} />

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Wordmark />
          </div>
          <AdminNavList sections={navSections} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
