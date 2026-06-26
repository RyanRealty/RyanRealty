'use client'

/**
 * TemplatePicker — searchable command-palette template selector.
 *
 * Replaces the flat <Select> in the lead-composer panel. On selection it
 * calls onSelect(key) — callers push the key into the page URL (?tpl= or
 * ?smsTpl=) so the server re-renders with the resolved template body, exactly
 * as the old <Select name="tpl"> + Load-button form did.
 *
 * Templates are grouped by category inside <CommandGroup>. A blank/null
 * category falls under "Uncategorized". The blank option ("Blank <channel>")
 * always appears first.
 *
 * Props:
 *   templates   — flat list from getCrmEmailTemplates / getCrmSmsTemplates +
 *                 an optional `category` field (provided when the component is
 *                 used from the admin settings page; on the lead console the
 *                 picker receives the lightweight composer shape which may not
 *                 have category — it just shows all in one group in that case)
 *   channel     — 'email' | 'sms' (used only for the "Blank" label)
 *   currentKey  — the currently selected key ('blank' or a template key)
 *   onSelect    — called with the chosen key
 *   className   — forwarded to the trigger button container
 */
import { useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type PickerTemplate = {
  key: string
  name: string
  subject?: string | null
  category?: string | null
}

const BLANK_KEY = 'blank'

function categoryOf(t: PickerTemplate): string {
  return (t.category ?? '').trim() || 'Uncategorized'
}

export function TemplatePicker({
  templates,
  channel,
  currentKey,
  onSelect,
  className,
}: {
  templates: PickerTemplate[]
  channel: 'email' | 'sms'
  currentKey: string | null | undefined
  onSelect: (key: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const active =
    currentKey === BLANK_KEY || !currentKey
      ? null
      : templates.find((t) => t.key === currentKey) ?? null

  // Group templates by category, preserving insertion order within each group.
  const grouped = new Map<string, PickerTemplate[]>()
  for (const t of templates) {
    const cat = categoryOf(t)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(t)
  }
  const categories = [...grouped.keys()].sort((a, b) =>
    a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b),
  )

  function choose(key: string) {
    setOpen(false)
    onSelect(key)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-9 flex-1 justify-between text-sm font-normal', className)}
        >
          <span className="truncate text-left">
            {active ? active.name : `Blank ${channel}`}
          </span>
          {active?.category ? (
            <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
              {active.category}
            </Badge>
          ) : null}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command filter={(value, search) => {
          // cmdk's value is lowercased name+subject+category concatenated below.
          if (!search.trim()) return 1
          return value.includes(search.toLowerCase()) ? 1 : 0
        }}>
          <CommandInput placeholder={`Search ${templates.length} templates…`} />
          <CommandList>
            <CommandEmpty>No templates match.</CommandEmpty>

            {/* Blank option always first */}
            <CommandGroup>
              <CommandItem
                value={`blank ${channel}`}
                onSelect={() => choose(BLANK_KEY)}
                data-checked={!active || undefined}
              >
                <span className="text-muted-foreground">Blank {channel}</span>
              </CommandItem>
            </CommandGroup>

            {categories.length > 0 ? <CommandSeparator /> : null}

            {categories.map((cat) => (
              <CommandGroup key={cat} heading={cat}>
                {(grouped.get(cat) ?? []).map((t) => (
                  <CommandItem
                    key={t.key}
                    // value fed into the filter — include name, subject, category
                    value={[t.name, t.subject ?? '', cat].join(' ').toLowerCase()}
                    onSelect={() => choose(t.key)}
                    data-checked={t.key === currentKey || undefined}
                  >
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.subject ? (
                      <span className="ml-2 max-w-[100px] truncate text-[11px] text-muted-foreground">
                        {t.subject}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
