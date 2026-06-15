'use client'

/**
 * ConsoleShell — the clean neutral broker workspace chrome.
 *
 * Deliberately NOT the brand AdminHeader/AdminSidebar. This is a purpose-built
 * operations surface (Linear/Notion register) per Matt directive 2026-06-15:
 * "we do not need to enforce the styles from our brand in the admin, it just
 * needs to be ultra intuitive." Colors come from the .console-root neutral
 * token scope (app/admin/console/console-theme.css).
 *
 * One shell, one rhythm: a sticky left rail on desktop, a sticky top bar with a
 * hamburger sheet on phones. Single nav source so the two can never drift.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import ConsoleCommandPalette from '@/components/console/ConsoleCommandPalette'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean }

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  leads: 'M16 17v2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
  deals: 'M3 3v18h18M7 14l3-3 3 3 5-6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  menu: 'M3 6h18M3 12h18M3 18h18',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16',
}

const NAV: NavItem[] = [
  { href: '/admin/console', label: 'Today', icon: <Icon path={ICONS.home} />, exact: true },
  { href: '/admin/console/leads', label: 'Leads', icon: <Icon path={ICONS.leads} /> },
]

// Surfaces still served by the brand admin until they are migrated into the
// console. Linked plainly so a broker is never stranded.
const CLASSIC: NavItem[] = [
  { href: '/admin/crm/inbox', label: 'Inbox', icon: <Icon path={ICONS.inbox} /> },
  { href: '/admin/deals', label: 'Transactions', icon: <Icon path={ICONS.deals} /> },
  { href: '/admin', label: 'All admin tools', icon: <Icon path={ICONS.grid} /> },
]

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
      )}
    >
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function NavBody({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
      ))}
      <div className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Brand admin
      </div>
      {CLASSIC.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function Wordmark() {
  return (
    <Link href="/admin/console" className="flex items-center gap-2.5 px-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">RR</span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Console</span>
    </Link>
  )
}

export default function ConsoleShell({
  user,
  brokerLabel,
  children,
}: {
  user: { email: string; fullName: string | null; avatarUrl: string | null }
  brokerLabel: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const initials = (user.fullName ?? user.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Wordmark />
        </div>
        <NavBody pathname={pathname} />
        <div className="border-t border-sidebar-border p-3">
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
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="h-10 w-10 p-0 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <Icon path={ICONS.menu} />
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
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Wordmark />
          </div>
          <NavBody pathname={pathname} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
