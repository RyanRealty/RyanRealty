'use client'

/**
 * ColumnChooser — the §8 column chooser flyout of the People list
 * (docs/crm-spec/05-people-list-and-bulk-actions.md).
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
import { IconButton, SearchField, ToolbarCheck } from '@/components/admin/v2'
import {
  PEOPLE_COLUMNS, DEFAULT_PEOPLE_COLUMNS, type PeopleColumnKey,
} from './people-list-utils'

// `style` is in the type so the icon can take var(--a-text-2) directly — the
// shadcn original carried that colour as a semantic utility class instead.
const COLUMN_ICON: Record<PeopleColumnKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
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
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--a-text-2)' }}>Columns</p>
        {/* title={undefined} beats IconButton's default title={label}: the
            shadcn ghost button this replaced had no title, so a native OS
            tooltip on hover is new chrome, not restored behaviour. The
            accessible name still comes from aria-label. */}
        <IconButton label="Close column chooser" title={undefined} onClick={onClose}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>
      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find a field"
        // type=text, not SearchField's default type=search: the browser's own
        // clear affordance was never part of this control.
        type="text"
        aria-label="Find a field"
        className="mt-2"
        style={{ width: '100%', maxWidth: 'none', minHeight: 36 }}
      />

      <div className="mt-3 space-y-4">
        {sections.map((section) => (
          <div key={section}>
            <p className="font-semibold uppercase tracking-widest" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{section}</p>
            <ul className="mt-1 space-y-0.5">
              {fields.filter((f) => f.section === section).map((f) => {
                const Icon = COLUMN_ICON[f.key]
                return (
                  <li key={f.key} className="rounded-md hover:bg-[var(--a-inset)]">
                    <ToolbarCheck
                      checked={visibleSet.has(f.key)}
                      onChange={() => onToggle(f.key)}
                      aria-label={`Toggle ${f.label} column`}
                      labelStyle={{
                        width: '100%',
                        padding: '6px',
                        color: 'var(--a-text)',
                        fontSize: 'var(--a-text-md)',
                        fontWeight: 400,
                      }}
                      label={
                        <>
                          <Icon className="h-3.5 w-3.5" style={{ color: 'var(--a-text-2)' }} aria-hidden />
                          {f.label}
                        </>
                      }
                    />
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
        className="mt-4 text-xs underline-offset-2 hover:underline"
        style={{ color: 'var(--a-text-2)' }}
      >
        Reset to default ({DEFAULT_PEOPLE_COLUMNS.length + 1} columns)
      </button>
    </div>
  )
}
