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
import { useState } from 'react'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'
import AdminNavList from '@/app/components/admin/AdminNavList'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import ConsoleCommandPalette from '@/components/console/ConsoleCommandPalette'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

function Wordmark() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 px-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">RR</span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Console</span>
    </Link>
  )
}

export default function ConsoleShell({
  user,
  brokerLabel,
  navSections,
  children,
}: {
  user: { email: string; fullName: string | null; avatarUrl: string | null }
  brokerLabel: string
  navSections: AdminNavSection[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const initials = (user.fullName ?? user.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNavList sections={navSections} />
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{user.fullName ?? 'Signed in'}</div>
              <div className="truncate text-xs text-muted-foreground">{brokerLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="h-10 w-10 p-0 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </Button>
          <div className="lg:hidden"><Wordmark /></div>
          <div className="ml-1 hidden lg:block"><ConsoleCommandPalette /></div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="lg:hidden"><ConsoleCommandPalette /></div>
            <a
              href="/"
              className="hidden h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
            >
              View site
            </a>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover lg:hidden" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground lg:hidden">{initials}</span>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>

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
