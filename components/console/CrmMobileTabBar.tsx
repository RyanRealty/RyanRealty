'use client'

/**
 * CrmMobileTabBar — the mobile bottom tab bar for phones.
 *
 * Matt directive 2026-06-26: the admin CRM must look + behave like the FUB iOS
 * app on mobile — a fixed 5-tab bottom bar that turns the console into a
 * thumb-reachable app. D9 (2026-07-17) keeps the tab set Home/Inbox/People/
 * Deals/Activity, but the tabs now arrive as a PROP derived from the ONE
 * capability-projected nav source (`buildAdminMobileTabs` — lib/admin/nav.ts
 * `tab` annotations). This component carries no route list of its own.
 *
 * Lives inside ConsoleShell, shown only below lg (the desktop top nav covers
 * lg+). Token-pure so it inherits the neutral .console-root scope. The
 * hamburger Sheet still provides the FULL admin nav — this bar is the fast path.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MobileTab } from '@/app/components/admin/admin-nav'
import { ADMIN_NAV_ICONS } from '@/app/components/admin/AdminNavIcons'
import { cn } from '@/lib/utils'

/** Static class map so Tailwind sees every literal (no arbitrary values). */
const TAB_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

/** Longest-prefix match so a nested route lights its owning tab, not a sibling. */
function activeHref(pathname: string, tabs: MobileTab[]): string {
  // §29: Calendar + Tasks are menu-reached surfaces in this shell (the D9.4 tab
  // set is Home/Inbox/People/Deals/Activity) — lighting People there via the
  // /admin/crm prefix would lie about where the user is. Nothing lights.
  if (/^\/admin\/crm\/(calendar|tasks)(\/|$)/.test(pathname)) return ''
  let best = ''
  for (const t of tabs) {
    const isMatch = pathname === t.href || pathname.startsWith(t.href + '/')
    if (isMatch && t.href.length > best.length) best = t.href
  }
  return best
}

export default function CrmMobileTabBar({ tabs, inboxUnread = 0 }: { tabs: MobileTab[]; inboxUnread?: number }) {
  const pathname = usePathname() ?? ''
  const active = activeHref(pathname, tabs)

  if (tabs.length === 0) return null

  // Matt directive 2026-07-02 (mobile punch list #1): the bar renders on EVERY
  // mobile CRM route, INCLUDING pushed detail views — "I do not have the bottom
  // bar like in follow up boss." This supersedes the earlier mob-02 suppression.
  // Full-screen overlays (MobileThread, MobileSettingsScreen) still occlude it
  // at z-50 — those are modals, not routes.

  return (
    // Slides away while the soft keyboard is up ([data-kb-open], set by
    // KeyboardInsetSync) — there is no room for nav above a keyboard, and
    // bottom-docked composers take its place (--crm-dock-offset).
    <nav
      aria-label="CRM quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur transition-transform duration-200 supports-[backdrop-filter]:bg-background/80 lg:hidden [[data-kb-open]_&]:pointer-events-none [[data-kb-open]_&]:translate-y-full"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* h-14 is load-bearing: --crm-dock-offset (console-theme.css) assumes
          the bar content is exactly 3.5rem tall. Column count tracks the tab
          count (a role holding fewer surfaces gets fewer, full-width tabs —
          grid-cols-5 with one tab squished it into the left fifth). */}
      <ul className={cn('grid h-14', TAB_GRID[tabs.length] ?? 'grid-cols-5')}>
        {tabs.map((t) => {
          const isActive = active === t.href
          const Icon = ADMIN_NAV_ICONS[t.icon]
          const showBadge = t.badge === 'inbox' && inboxUnread > 0
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors',
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
