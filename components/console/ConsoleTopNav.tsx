'use client'

/**
 * ConsoleTopNav — the FUB-style dark horizontal top navigation (desktop, lg+).
 *
 * Matt directive 2026-06-26: the desktop CRM should look like Follow Up Boss — a
 * dark navy top bar with the logo, the 5 top-level menus (Dashboard · CRM ·
 * Deals · Reports · Admin), global search, and right-side account controls.
 * Single-item groups are direct links; multi-item groups open a dropdown of
 * their submenu. Active group is highlighted by the current path.
 *
 * Shown only at lg+ (`hidden lg:flex`); phones keep the hamburger sheet + bottom
 * tab bar. Navy is the brand color applied inline (gate-safe) so the bar reads
 * navy regardless of the neutral console token scope; the white wordmark sits on
 * it. The data is the same `buildAdminNav` source the rail/sheet use.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import ConsoleCommandPalette from '@/components/console/ConsoleCommandPalette'
import { cn } from '@/lib/utils'

const NAVY = '#102742'

function sectionActive(pathname: string, section: AdminNavSection): boolean {
  return section.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
}

const itemClass =
  'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white'

export default function ConsoleTopNav({
  sections,
  user,
}: {
  sections: AdminNavSection[]
  user: { email: string; fullName: string | null; avatarUrl: string | null }
}) {
  const pathname = usePathname() ?? ''
  const initials = (user.fullName ?? user.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <nav
      style={{ backgroundColor: NAVY }}
      className="sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-1 px-4 lg:flex"
      aria-label="Primary"
    >
      <Link href="/admin" className="mr-3 flex shrink-0 items-center" aria-label="Ryan Realty">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-horizontal-white.png" alt="Ryan Realty" className="h-6 w-auto" />
      </Link>

      {sections.map((s) => {
        const active = sectionActive(pathname, s)
        if (s.items.length === 1) {
          return (
            <Link
              key={s.label}
              href={s.items[0].href}
              className={cn(itemClass, active && 'bg-white/15 text-white')}
            >
              {s.label}
            </Link>
          )
        }
        return (
          <DropdownMenu key={s.label}>
            <DropdownMenuTrigger className={cn(itemClass, active && 'bg-white/15 text-white')}>
              {s.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {s.items.map((i) => (
                <DropdownMenuItem key={i.href} asChild>
                  <Link href={i.href}>{i.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}

      <div className="ml-auto flex items-center gap-2">
        <div className="w-64 [&_button]:bg-white/10 [&_button]:text-white/70 [&_button]:hover:bg-white/15">
          <ConsoleCommandPalette />
        </div>
        <a
          href="/"
          className="hidden h-9 items-center rounded-md px-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white xl:inline-flex"
        >
          View site
        </a>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {initials}
          </span>
        )}
      </div>
    </nav>
  )
}
