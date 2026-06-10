'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'

type AdminNavListProps = {
  sections: AdminNavSection[]
  onNavigate?: () => void
}

/** Shared grouped nav body for the desktop sidebar and the mobile sheet. */
export default function AdminNavList({ sections, onNavigate }: AdminNavListProps) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-1 flex-col gap-4 p-3">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon }) => {
              const base = href.split('?')[0]
              const isActive = pathname === base || pathname?.startsWith(base + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
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
          </div>
        </div>
      ))}
    </nav>
  )
}
