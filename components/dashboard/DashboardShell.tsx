'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { Button } from "@/components/ui/button"

type DashboardShellProps = {
  user: {
    id: string
    email: string
    firstName: string
    avatarUrl: string | null
  }
  children: React.ReactNode
}

const navItems: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Overview', icon: '◉' },
  { href: '/dashboard/saved', label: 'Saved Homes', icon: '♥' },
  { href: '/dashboard/searches', label: 'Saved Searches', icon: '🔍' },
  { href: '/dashboard/collections', label: 'My Collections', icon: '📁' },
  { href: '/dashboard/history', label: 'Viewing History', icon: '🕐' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/dashboard/settings', label: 'Settings & Preferences', icon: '⚙' },
]

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-muted">
      {/* Top bar - mobile: hamburger + title; desktop: welcome + avatar + bell */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? '×' : '☰'}
          </Button>
          <h1 className="text-lg font-semibold text-foreground lg:text-xl">
            Welcome back, {user.firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <span aria-hidden>🔔</span>
          </Link>
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {user.firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - collapsible on mobile */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card pt-16 transition-transform lg:static lg:z-0 lg:pt-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          aria-label="Dashboard navigation"
        >
          <nav className="flex flex-col gap-0.5 p-3">
            {navItems.map(({ href, label, icon }) => {
              const isActive =
                pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="text-base opacity-80" aria-hidden>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto border-t border-border p-3">
            <form action={signOut}>
              <Button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        {/* Overlay when sidebar open on mobile */}
        {sidebarOpen && (
          <Button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
