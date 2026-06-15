'use client'

/**
 * ConsoleCommandPalette — ⌘K / Ctrl+K from anywhere in the console.
 *
 * Patterns borrowed from Linear + Superhuman (the research): a fuzzy launcher
 * that JUMPS to a lead by name and runs the common navigations, with the
 * keyboard hint shown inline to teach the shortcut. Lead results come from a
 * scoped server action (own book / all per role). Static nav is matched
 * client-side; lead hits are appended live, so cmdk's own filter is disabled.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { consoleSearchLeads, type ConsoleLeadHit } from '@/app/actions/console'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

const NAV = [
  { label: 'Today', href: '/admin/console' },
  { label: 'Leads', href: '/admin/console/leads' },
  { label: 'Inbox (brand admin)', href: '/admin/crm/inbox' },
  { label: 'Transactions (brand admin)', href: '/admin/deals' },
]

export default function ConsoleCommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ConsoleLeadHit[]>([])
  const [, startTransition] = useTransition()
  const seq = useRef(0)

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

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setHits([]); return }
    const mine = ++seq.current
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await consoleSearchLeads(q)
        if (mine === seq.current) setHits(r)
      })
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  const go = useCallback((href: string) => { setOpen(false); setQuery(''); router.push(href) }, [router])

  const navMatches = NAV.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Open command palette"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3.5 w-3.5"><path d="M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16" /></svg>
        <span className="hidden sm:inline">Search or jump to…</span>
        <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="top-1/4 translate-y-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandInput placeholder="Search a lead by name, or jump to a page…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              {navMatches.length > 0 ? (
                <CommandGroup heading="Go to">
                  {navMatches.map((n) => (
                    <CommandItem key={n.href} value={n.href} onSelect={() => go(n.href)}>{n.label}</CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {hits.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Leads">
                    {hits.map((h) => (
                      <CommandItem key={h.id} value={`lead-${h.id}`} onSelect={() => go(`/admin/console/leads/${h.id}`)}>
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{h.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{h.stage}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
