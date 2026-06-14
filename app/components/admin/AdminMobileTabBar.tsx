'use client'

/**
 * Phone-native bottom tab bar for the admin — the five daily destinations one
 * thumb-tap away. Visible below lg only; desktop keeps the sidebar. The
 * protected layout pads the content bottom so the bar never covers actions.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Inbox, LayoutDashboard, ListTodo, Users } from 'lucide-react'
import type { AdminRoleType } from '@/app/actions/admin-roles'

const TABS = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/crm/inbox', label: 'Inbox', icon: Inbox },
  { href: '/admin/crm', label: 'Contacts', icon: Users },
  { href: '/admin/crm/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/admin/analytics/action-required', label: 'Hot', icon: Flame, brokersOnly: true },
] as const

export default function AdminMobileTabBar({ role }: { role: AdminRoleType }) {
  const pathname = usePathname()
  const canBrokers = role === 'superuser' || role === 'broker'
  const tabs = TABS.filter((t) => !('brokersOnly' in t && t.brokersOnly) || canBrokers)

  const matches = (base: string) => pathname === base || pathname?.startsWith(base + '/')
  const best = tabs.map((t) => t.href).filter(matches).sort((a, b) => b.length - a.length)[0]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Quick navigation"
    >
      <div className="grid auto-cols-fr grid-flow-col">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === best
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
