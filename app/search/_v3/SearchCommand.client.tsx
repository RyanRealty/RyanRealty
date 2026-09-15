'use client'

/**
 * shadcn Command on the search dock. Opens a palette of places — not a dead F chip.
 */
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { SEARCH_PLACE_SEEDS } from './search-places'

export type SearchCommandProps = {
  onOpenFilters?: () => void
}

export function SearchCommand({ onOpenFilters }: SearchCommandProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

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
        className="srch-command-trigger shrink-0 px-3"
        aria-label="Search command"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Command
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Cities and communities"
      >
        <CommandInput placeholder="Bend, Tetherow, or an address" />
        <CommandList>
          <CommandEmpty>No places match that.</CommandEmpty>
          <CommandGroup heading="Places">
            {SEARCH_PLACE_SEEDS.map((place) => (
              <CommandItem
                key={place.id}
                value={`${place.title} ${place.description}`}
                onSelect={() => go(place.id)}
              >
                {place.title}
                <span className="text-muted-foreground ml-auto text-xs">{place.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {onOpenFilters ? (
            <CommandGroup heading="Filters">
              <CommandItem
                value="all filters"
                onSelect={() => {
                  setOpen(false)
                  onOpenFilters()
                }}
              >
                All filters
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
