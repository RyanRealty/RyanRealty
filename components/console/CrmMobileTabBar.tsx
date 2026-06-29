'use client'

/**
 * CrmMobileTabBar — the Follow Up Boss–style bottom tab bar for phones.
 *
 * Matt directive 2026-06-26: the admin CRM must look + behave like the FUB iOS
 * app on mobile. FUB's signature is a fixed 5-tab bottom bar (Inbox / Activity /
 * Calendar / People / Deals) that turns the console into a thumb-reachable app.
 * We map those to the five daily CRM surfaces that already exist as routes.
 *
 * Lives inside ConsoleShell, shown only below lg (the desktop rail covers nav at
 * lg+). Token-pure so it inherits the neutral .console-root scope. The hamburger
 * Sheet still provides the FULL admin nav — this bar is the fast path.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Inbox, Users, Layers, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = {
  href: string
  label: string
  icon: typeof Home
  /** Extra path prefixes that should light this tab (e.g. the lead detail). */
  also?: string[]
}

const TABS: Tab[] = [
  { href: '/admin/broker-dashboard', label: 'Home', icon: Home },
  { href: '/admin/crm/inbox', label: 'Inbox', icon: Inbox },
  {
    href: '/admin/crm',
    label: 'People',
    icon: Users,
    also: ['/admin/console/leads', '/admin/people'],
  },
  { href: '/admin/crm/deals', label: 'Deals', icon: Layers },
  { href: '/admin/crm/activity', label: 'Activity', icon: Activity },
]

/** Longest-prefix match so /admin/crm/inbox lights Inbox, not People. */
function activeHref(pathname: string): string {
  let best = ''
  for (const t of TABS) {
    const candidates = [t.href, ...(t.also ?? [])]
    for (const c of candidates) {
      const isMatch = pathname === c || pathname.startsWith(c + '/')
      if (isMatch && c.length > best.length) best = t.href
    }
  }
  return best
}

export default function CrmMobileTabBar({ inboxUnread = 0 }: { inboxUnread?: number }) {
  const pathname = usePathname() ?? ''
  const active = activeHref(pathname)

  return (
    <nav
      aria-label="CRM quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const isActive = active === t.href
          const Icon = t.icon
          const showBadge = t.href === '/admin/crm/inbox' && inboxUnread > 0
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {showBadge ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
                      {inboxUnread > 99 ? '99+' : inboxUnread}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
