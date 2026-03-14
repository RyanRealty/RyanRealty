'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AdminRoleType } from '@/app/actions/admin-roles'

type AdminSidebarProps = {
  role: AdminRoleType
  brokerId: string | null
}

const navItem = (href: string, label: string, icon: string) => ({ href, label, icon })

export default function AdminSidebar({ role, brokerId }: AdminSidebarProps) {
  const pathname = usePathname()
  const isSuperuser = role === 'superuser'
  const canReports = isSuperuser || role === 'report_viewer'
  const canBrokers = isSuperuser || role === 'broker'
  const canFullAdmin = isSuperuser

  const main: Array<{ href: string; label: string; icon: string }> = [
    navItem('/admin', 'Dashboard', '◉'),
    navItem('/admin/listings', 'Listings', '🏠'),
    navItem('/admin/sync', 'Sync status', '🔄'),
  ]
  if (isSuperuser) {
    main.push(navItem('/admin/users', 'Users', '👤'))
    main.push(navItem('/admin/expired-listings', 'Expired listings', '🏚'))
    main.push(navItem('/admin/audit-log', 'Audit log', '📋'))
    main.push(navItem('/admin/optimization', 'Optimization', '📈'))
  }
  if (canBrokers) main.push(navItem(role === 'broker' && brokerId ? `/admin/brokers?highlight=${brokerId}` : '/admin/brokers', role === 'broker' ? 'My profile' : 'Brokers', '👔'))
  if (canFullAdmin) {
    main.push(
      navItem('/admin/geo', 'Communities & geo', '📍'),
      navItem('/admin/resort-communities', 'Resort & master plan', '🏘'),
      navItem('/admin/site-pages', 'Site pages', '📄'),
      navItem('/admin/banners', 'Banners', '🖼'),
      navItem('/admin/query-builder', 'Query builder', '🔍'),
    )
  }
  if (canReports) main.push(navItem('/admin/reports', 'Reports', '📊'))
  main.push(navItem('/admin/email/compose', 'Email', '✉'))
  if (canFullAdmin) main.push(navItem('/admin/spark-status', 'Spark', '⚡'))

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-border bg-card"
      aria-label="Admin navigation"
    >
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {main.map(({ href, label, icon }) => {
          const base = href.split('?')[0]
          const isActive = pathname === base || (pathname?.startsWith(base + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="text-base opacity-80" aria-hidden>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
