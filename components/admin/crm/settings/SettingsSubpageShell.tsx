import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/**
 * SettingsSubpageShell — shared chrome for every /admin/crm/settings sub-page.
 *
 * A server component (no client state) that gives each config sub-page the same
 * title block + "Back to settings" link so the eight surfaces read as one hub.
 * The editable body (the client ConfigTableEditor or a richer editor) is passed
 * as children.
 */
export function SettingsSubpageShell({
  title,
  description,
  wide = false,
  children,
}: {
  title: string
  description: string
  /** Wide surfaces (the §13 templates tables) need more than max-w-5xl. */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <main className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-5xl'} px-4 py-8 sm:px-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div className="min-w-0">
          <nav className="mb-1 text-xs text-muted-foreground">
            <Link href="/admin/crm/settings" className="hover:text-foreground">
              CRM settings
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-foreground">{title}</span>
          </nav>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Link href="/admin/crm/settings" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 md:h-7">
            Back to settings
          </Button>
        </Link>
      </div>

      <div className="mt-6">{children}</div>
    </main>
  )
}
