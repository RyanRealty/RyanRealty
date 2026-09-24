'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Account nav (Phase 4.1 consolidation).
 *
 * /account is now the portal: alerts, areas, homes, and activity are TABS on
 * that one surface, not separate destinations. This nav therefore carries the
 * portal plus the settings-shaped pages that stay standalone. The folded routes
 * (/account/saved-homes, /account/hidden, /account/saved-searches,
 * /account/areas, /account/history, /account/collections) still exist and still
 * render, because alert emails and older links point at them.
 *
 * `hasTransactions` (client-transactions, 2026-09-23): the Transactions tab
 * only shows for a signed-in buyer/seller with at least one linked deal.
 * app/account/layout.tsx computes that flag server-side (getClientIdentity +
 * listClientDeals) and passes it down, fail-safe to false on any error — a
 * broken read just hides the tab rather than breaking the account shell.
 */
type NavLink = { href: string; label: string; exact?: boolean }

const ACCOUNT_NAV_LINKS: NavLink[] = [
  { href: '/account', label: 'Overview', exact: true },
  { href: '/account/saved-cities', label: 'Saved cities' },
  { href: '/account/saved-communities', label: 'Saved communities' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/buying-preferences', label: 'Buying preferences' },
  { href: '/account/profile', label: 'Profile' },
  // Most people saving homes also own one. The dashboard carried no way to ask
  // what theirs is worth — a signed-in owner had to leave the portal and find
  // /sell on their own (Matt 2026-08-26). External to /account on purpose: the
  // valuation flow is its own funnel, not an account settings page.
  { href: '/sell', label: 'Value my home' },
]

const TRANSACTIONS_LINK: NavLink = { href: '/account/transactions', label: 'Transactions' }

export default function AccountNav({ hasTransactions = false }: { hasTransactions?: boolean }) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const links: NavLink[] = hasTransactions
    ? [ACCOUNT_NAV_LINKS[0]!, TRANSACTIONS_LINK, ...ACCOUNT_NAV_LINKS.slice(1)]
    : ACCOUNT_NAV_LINKS

  return (
    <nav
      className="mb-8 flex gap-1 overflow-x-auto no-scrollbar border-b border-border pb-4"
      aria-label="Account"
    >
      {links.map(({ href, label, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
