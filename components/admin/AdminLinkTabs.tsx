'use client'

/**
 * AdminLinkTabs — sub-route tab bar for consolidated admin surfaces
 * (Media library, Geography, System health, Operations).
 *
 * Route-backed tabs (each tab is its own page under a shared layout), styled
 * to match the underline tabs in the CRM Deals sub-bar. Active tab = the
 * longest href that matches the current pathname (exact or prefix), so nested
 * sub-routes like /admin/geo/area-guide-upload keep their parent tab lit.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type AdminLinkTab = { href: string; label: string }

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminLinkTabs({ tabs }: { tabs: AdminLinkTab[] }) {
  const pathname = usePathname()

  // Longest matching href wins so the root tab doesn't shadow sub-route tabs.
  const activeHref = tabs
    .filter((t) => matches(pathname, t.href))
    .reduce<string | null>((best, t) => (best && best.length >= t.href.length ? best : t.href), null)

  return (
    <nav aria-label="Section tabs" className="border-b border-border">
      <div className="flex flex-wrap items-center gap-1">
        {tabs.map((t) => {
          const active = t.href === activeHref
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
