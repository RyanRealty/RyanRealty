'use client'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export type SearchCommandItem = {
  id: string
  group: string
  label: string
  sublabel?: string
}

export function SearchCommand({
  items,
  highlight,
  idPrefix,
  onPick,
  className,
}: {
  items: SearchCommandItem[]
  highlight: number
  idPrefix: string
  onPick: (id: string) => void
  className?: string
}) {
  const groups = items.reduce<Record<string, SearchCommandItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? []
    acc[item.group]!.push(item)
    return acc
  }, {})

  return (
    <Command className={className} shouldFilter={false} data-taste="search-command">
      <CommandList id={`${idPrefix}-listbox`} aria-label="Search suggestions">
        <CommandEmpty>No results</CommandEmpty>
        {Object.entries(groups).map(([group, rows]) => (
          <CommandGroup key={group} heading={group}>
            {rows.map((item) => {
              const index = items.indexOf(item)
              return (
                <CommandItem
                  key={item.id}
                  id={`${idPrefix}-item-${index}`}
                  value={item.id}
                  data-selected={index === highlight}
                  onSelect={() => onPick(item.id)}
                >
                  <span>{item.label}</span>
                  {item.sublabel ? (
                    <span className="ml-1.5 text-muted-foreground">({item.sublabel})</span>
                  ) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}
