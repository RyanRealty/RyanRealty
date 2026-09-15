'use client'

/**
 * shadcn Command as the dock palette — cmdk groups, shortcuts, empty.
 * Not a cream card of the same Places list (demoMatch false).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { SEARCH_PLACE_SEEDS } from './search-places'

export type SearchCommandProps = {
  onOpenFilters?: () => void
}

export function SearchCommand({ onOpenFilters }: SearchCommandProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((next) => !next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="srch-command-trigger shrink-0 gap-2 px-3"
        aria-label="Search command"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Command
        <kbd className="text-muted-foreground hidden rounded-sm border border-border px-1 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command"
        description="Jump, filter, or sort this search"
      >
        <CommandInput placeholder="Type a command or place" />
        <CommandList>
          <CommandEmpty>No command matches that.</CommandEmpty>
          <CommandGroup heading="View">
            <CommandItem value="split view" onSelect={() => go('/homes-for-sale?view=split')}>
              Split
              <CommandShortcut>S</CommandShortcut>
            </CommandItem>
            <CommandItem value="map view" onSelect={() => go('/homes-for-sale?view=map')}>
              Map
              <CommandShortcut>M</CommandShortcut>
            </CommandItem>
            <CommandItem value="list view" onSelect={() => go('/homes-for-sale?view=list')}>
              List
              <CommandShortcut>L</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Filters">
            {onOpenFilters ? (
              <CommandItem
                value="all filters"
                onSelect={() => {
                  setOpen(false)
                  onOpenFilters()
                }}
              >
                All filters
                <CommandShortcut>A</CommandShortcut>
              </CommandItem>
            ) : null}
            <CommandItem value="for sale active" onSelect={() => go('/homes-for-sale?status=Active')}>
              For sale
            </CommandItem>
            <CommandItem value="sold closed" onSelect={() => go('/homes-for-sale?status=Sold')}>
              Sold
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Sort">
            <CommandItem value="sort newest" onSelect={() => go('/homes-for-sale?sort=newest')}>
              Newest
            </CommandItem>
            <CommandItem value="sort price low" onSelect={() => go('/homes-for-sale?sort=price_asc')}>
              Price, low to high
            </CommandItem>
            <CommandItem value="sort price high" onSelect={() => go('/homes-for-sale?sort=price_desc')}>
              Price, high to low
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Places">
            {SEARCH_PLACE_SEEDS.map((place) => (
              <CommandItem
                key={place.id}
                value={`${place.title} ${place.description} place`}
                onSelect={() => go(place.id)}
              >
                {place.title}
                <span className="text-muted-foreground ml-auto text-xs">{place.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
