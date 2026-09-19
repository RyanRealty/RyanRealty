'use client'

import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  SUGGEST_GROUP_LABELS,
  type SuggestItem,
  type SuggestKind,
} from '@/components/search/SearchSuggest'

/**
 * shadcn Command adapted into the morphing search results (SITE-110).
 * shouldFilter is off — the field already fetched the groups.
 */
export function SearchCommandList({
  items,
  loading = false,
  hasResult = false,
  highlight = -1,
  idPrefix,
  onPick,
  className,
}: {
  items: SuggestItem[]
  loading?: boolean
  hasResult?: boolean
  highlight?: number
  idPrefix: string
  onPick: (item: SuggestItem) => void
  className?: string
}) {
  const groups: Array<{ kind: SuggestKind; rows: Array<{ item: SuggestItem; index: number }> }> = []
  for (const [index, item] of items.entries()) {
    const last = groups[groups.length - 1]
    if (!last || last.kind !== item.kind) groups.push({ kind: item.kind, rows: [{ item, index }] })
    else last.rows.push({ item, index })
  }

  return (
    <Command
      shouldFilter={false}
      className={cn('srch-command rounded-none bg-background p-0', className)}
    >
      <CommandList id={`${idPrefix}-listbox`} aria-label="Search suggestions">
        {loading && items.length === 0 ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : hasResult && items.length === 0 ? (
          <CommandEmpty>No results</CommandEmpty>
        ) : (
          groups.map((group) => (
            <CommandGroup key={group.kind} heading={SUGGEST_GROUP_LABELS[group.kind]}>
              {group.rows.map(({ item, index }) => {
                const active = index === highlight
                return (
                  <CommandItem
                    key={`${item.kind}-${index}-${item.href}`}
                    id={`${idPrefix}-item-${index}`}
                    value={`${item.kind}-${item.href}`}
                    data-selected={active || undefined}
                    onSelect={() => onPick(item)}
                    className="p-0"
                  >
                    <a
                      href={item.href}
                      tabIndex={-1}
                      className="block w-full px-2 py-1.5 text-left"
                      onMouseDown={(event) => {
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                          return
                        }
                        event.preventDefault()
                        onPick(item)
                      }}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        event.preventDefault()
                      }}
                    >
                      {item.label}
                      {item.sublabel ? (
                        <span className="ml-1.5 text-muted-foreground">({item.sublabel})</span>
                      ) : null}
                    </a>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))
        )}
      </CommandList>
    </Command>
  )
}
