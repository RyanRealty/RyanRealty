'use client'

/**
 * Admin command palette — Cmd+K (Ctrl+K) from anywhere in the admin.
 * Every nav destination is searchable by name; free text falls through to
 * the global admin search (/admin/search?q=…) for leads, listings, users.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import type { AdminNavSection } from '@/app/components/admin/admin-nav'
import { ADMIN_NAV_ICONS } from '@/app/components/admin/AdminNavIcons'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

export default function AdminCommandPalette({ sections }: { sections: AdminNavSection[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
    },
    [router],
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-72 justify-start gap-2 px-3 font-normal text-muted-foreground md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-xs">⌘K</kbd>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-muted-foreground md:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4" aria-hidden />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Go to" description="Jump to any admin page or search">
        <CommandInput placeholder="Type a page name, or search leads and listings…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No pages match. Press Enter to search the site.</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.label} heading={section.label}>
              {section.items.map(({ href, label, icon }) => {
                const Icon = ADMIN_NAV_ICONS[icon]
                return (
                  <CommandItem key={href} value={`${section.label} ${label}`} onSelect={() => go(href)}>
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
          {query.trim() ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Search">
                <CommandItem value={`search-${query}`} onSelect={() => go(`/admin/search?q=${encodeURIComponent(query.trim())}`)}>
                  <Search className="h-4 w-4" aria-hidden />
                  Search leads, listings, users for &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
