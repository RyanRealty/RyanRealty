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
  ]
  if (isSuperuser) main.push(navItem('/admin/users', 'Users', '👤'))
  if (canBrokers) main.push(navItem(role === 'broker' && brokerId ? `/admin/brokers?highlight=${brokerId}` : '/admin/brokers', role === 'broker' ? 'My profile' : 'Brokers', '👔'))
  if (canFullAdmin) {
    main.push(
      navItem('/admin/site-pages', 'Site pages', '📄'),
      navItem('/admin/sync', 'Sync', '🔄'),
      navItem('/admin/geo', 'Geo', '📍'),
      navItem('/admin/resort-communities', 'Resort communities', '🏘'),
      navItem('/admin/banners', 'Banners', '🖼'),
    )
  }
  if (canReports) main.push(navItem('/admin/reports', 'Reports', '📊'))
  if (canFullAdmin) main.push(navItem('/admin/spark-status', 'Spark', '⚡'))

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white"
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
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
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
