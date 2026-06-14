'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ACCOUNT_NAV_LINKS = [
  { href: '/account', label: 'Dashboard', exact: true },
  { href: '/account/saved-homes', label: 'Saved homes' },
  { href: '/account/saved-searches', label: 'Saved searches' },
  { href: '/account/collections', label: 'Collections' },
  { href: '/account/history', label: 'Viewing history' },
  { href: '/account/saved-cities', label: 'Saved cities' },
  { href: '/account/saved-communities', label: 'Saved communities' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/buying-preferences', label: 'Buying preferences' },
  { href: '/account/profile', label: 'Profile' },
] as const

export default function AccountNav() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="mb-8 flex gap-1 overflow-x-auto no-scrollbar border-b border-border pb-4"
      aria-label="Account"
    >
      {ACCOUNT_NAV_LINKS.map(({ href, label, ...rest }) => {
        const exact = 'exact' in rest ? rest.exact : false
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
