'use client'

/**
 * ColumnChooser — the §8 column chooser flyout of the People list
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Opens in the SAME right-panel slot as the filter panel (PeopleListView swaps
 * the slot content; closing the chooser restores the filter panel — §2 layout
 * behavior). Search input at top, fields grouped under section headers, each
 * row a type icon + name + checkbox. The configuration is saved per list
 * (localStorage key `crm.people.columns.<viewId|all>` — §8 per-list column
 * config; server-side persistence is a logged deferral).
 */

import { useState } from 'react'
import { Type, Phone, Mail, Tag, Info, CalendarDays, UserRound, Globe, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  PEOPLE_COLUMNS, DEFAULT_PEOPLE_COLUMNS, type PeopleColumnKey,
} from './people-list-utils'

const COLUMN_ICON: Record<PeopleColumnKey, React.ComponentType<{ className?: string }>> = {
  leadScore: Info,
  agent: UserRound,
  lastVisit: Globe,
  phone: Phone,
  email: Mail,
  lastActivity: CalendarDays,
  tags: Tag,
  created: CalendarDays,
  stage: Type,
  source: Type,
  price: Info,
  timeframe: CalendarDays,
}

export type ColumnChooserProps = {
  visible: PeopleColumnKey[]
  onToggle: (key: PeopleColumnKey) => void
  onReset: () => void
  onClose: () => void
}

export default function ColumnChooser({ visible, onToggle, onReset, onClose }: ColumnChooserProps) {
  const [search, setSearch] = useState('')
  const ql = search.trim().toLowerCase()
  const fields = PEOPLE_COLUMNS.filter((c) => !ql || c.label.toLowerCase().includes(ql))
  const sections = Array.from(new Set(fields.map((f) => f.section)))
  const visibleSet = new Set(visible)

  return (
    <div data-testid="column-chooser">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Close column chooser">
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find a field"
        className="mt-2 h-9 text-sm"
        aria-label="Find a field"
      />

      <div className="mt-3 space-y-4">
        {sections.map((section) => (
          <div key={section}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{section}</p>
            <ul className="mt-1 space-y-0.5">
              {fields.filter((f) => f.section === section).map((f) => {
                const Icon = COLUMN_ICON[f.key]
                return (
                  <li key={f.key}>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-normal hover:bg-muted/60">
                      <Checkbox
                        checked={visibleSet.has(f.key)}
                        onCheckedChange={() => onToggle(f.key)}
                        aria-label={`Toggle ${f.label} column`}
                      />
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {f.label}
                    </Label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Reset to default ({DEFAULT_PEOPLE_COLUMNS.length + 1} columns)
      </button>
    </div>
  )
}
