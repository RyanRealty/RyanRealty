'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'
import { ADMIN_NAV_ICONS } from '@/app/components/admin/AdminNavIcons'
import { Button } from '@/components/ui/button'

type AdminNavListProps = {
  sections: AdminNavSection[]
  onNavigate?: () => void
}

const STORAGE_KEY = 'rr-admin-nav-open'

function loadStored(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

/**
 * Shared grouped nav body for the desktop sidebar and the mobile sheet.
 * Sections are collapsible: daily-use groups open by default, archives
 * collapsed; the user's choices persist in localStorage and the section
 * holding the active route always opens.
 */
export default function AdminNavList({ sections, onNavigate }: AdminNavListProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setOpen(loadStored())
    setHydrated(true)
  }, [])

  const isItemActive = (href: string) => {
    const base = href.split('?')[0]
    return pathname === base || pathname?.startsWith(base + '/')
  }

  const toggle = (label: string, fallback: boolean) => {
    setOpen((prev) => {
      const next = { ...prev, [label]: !(prev[label] ?? fallback) }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* private mode */
      }
      return next
    })
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {sections.map((section) => {
        const hasActive = section.items.some((i) => isItemActive(i.href))
        // SSR + first client paint use defaults only (localStorage is not
        // available on the server) — stored prefs apply after hydration.
        const stored = hydrated ? open[section.label] : undefined
        const isOpen = hasActive || (stored ?? section.defaultOpen)
        return (
          <div key={section.label}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => toggle(section.label, section.defaultOpen)}
              className="h-auto w-full justify-between rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
              aria-expanded={isOpen}
            >
              {section.label}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden />
            </Button>
            {isOpen ? (
              <div className="flex flex-col gap-0.5 pb-2">
                {section.items.map(({ href, label, icon }) => {
                  const isActive = isItemActive(href)
                  const Icon = ADMIN_NAV_ICONS[icon]
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? '' : 'opacity-70'}`} aria-hidden />
                      {label}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
