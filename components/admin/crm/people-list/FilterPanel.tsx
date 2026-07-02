'use client'

/**
 * FilterPanel — the §9 PERSISTENT right filter panel of the People list
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Always visible on the People view (it never auto-closes; switching lists
 * repopulates it). Two states:
 *   - Empty (§9.1): sliders icon + "No filters added yet" under the
 *     "Add a filter" input.
 *   - Populated (§9.2/9.3): one collapsed row per active filter, each
 *     expandable (accordion, NOT mutually exclusive) to its value editor.
 *
 * The in-house filter model is URL-driven (?stage= / ?tag= / ?q=), applied
 * server-side by listCrmPeople under the caller's frozen broker scope — so
 * every edit here is an instant navigation, and "include any" is the supported
 * operator (§9.5's full operator matrix is a logged deferral).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type FilterOption = { key: string; label: string }

export type PeopleFilters = {
  q?: string
  stage?: string
  tagsAny?: string[]
}

export type FilterPanelProps = {
  filters: PeopleFilters
  stageOptions: FilterOption[]
  tagOptions: FilterOption[]
  /** Params carried through every filter navigation (broker/pond/view). */
  carry: Record<string, string | undefined>
}

type FilterField = 'stage' | 'tag' | 'q'

const FIELD_LABEL: Record<FilterField, string> = { stage: 'Stage', tag: 'Tags', q: 'Name' }

export default function FilterPanel({ filters, stageOptions, tagOptions, carry }: FilterPanelProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<FilterField>>(new Set())
  /** Fields added via "Add a filter" but not yet valued (render expanded, empty). */
  const [draftFields, setDraftFields] = useState<Set<FilterField>>(new Set())

  const navigate = (next: PeopleFilters) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(carry)) if (v) p.set(k, v)
    if (next.q) p.set('q', next.q)
    if (next.stage) p.set('stage', next.stage)
    if (next.tagsAny?.[0]) p.set('tag', next.tagsAny[0])
    const qs = p.toString()
    router.push(qs ? `/admin/crm?${qs}` : '/admin/crm')
  }

  const active: Array<{ field: FilterField; summary: string }> = []
  if (filters.stage) active.push({ field: 'stage', summary: `Stage includes any of: ${filters.stage}` })
  if (filters.tagsAny?.length) active.push({ field: 'tag', summary: `Tags include any of: ${filters.tagsAny.join(', ')}` })
  if (filters.q) active.push({ field: 'q', summary: `Name contains: ${filters.q}` })

  const rows: Array<{ field: FilterField; summary: string; isDraft: boolean }> = [
    ...active.map((a) => ({ ...a, isDraft: false })),
    ...Array.from(draftFields)
      .filter((f) => !active.some((a) => a.field === f))
      .map((f) => ({ field: f, summary: `${FIELD_LABEL[f]}…`, isDraft: true })),
  ]

  const toggleExpand = (field: FilterField) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const addDraft = (field: FilterField) => {
    setDraftFields((prev) => new Set(prev).add(field))
    setExpanded((prev) => new Set(prev).add(field))
    setSearch('')
  }

  const removeFilter = (field: FilterField) => {
    setDraftFields((prev) => { const n = new Set(prev); n.delete(field); return n })
    navigate({
      q: field === 'q' ? undefined : filters.q,
      stage: field === 'stage' ? undefined : filters.stage,
      tagsAny: field === 'tag' ? undefined : filters.tagsAny,
    })
  }

  // "Add a filter" candidates matching the typed search, excluding present rows.
  const present = new Set(rows.map((r) => r.field))
  const candidates = (Object.keys(FIELD_LABEL) as FilterField[])
    .filter((f) => !present.has(f))
    .filter((f) => !search.trim() || FIELD_LABEL[f].toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div data-testid="filter-panel">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Add a filter"
        className="h-9 text-sm"
        aria-label="Add a filter"
      />
      {search.trim() || (candidates.length > 0 && rows.length > 0) ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {candidates.map((f) => (
            <Button key={f} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addDraft(f)}>
              + {FIELD_LABEL[f]}
            </Button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        /* §9.1 empty state */
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm text-muted-foreground">No filters added yet</p>
          {candidates.length > 0 && !search.trim() ? (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {candidates.map((f) => (
                <Button key={f} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addDraft(f)}>
                  + {FIELD_LABEL[f]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
          {rows.map(({ field, summary, isDraft }) => {
            const isOpen = expanded.has(field) || isDraft
            return (
              <div key={field}>
                <button
                  type="button"
                  onClick={() => toggleExpand(field)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 truncate">{summary}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', isOpen ? 'rotate-180' : '')} aria-hidden />
                </button>
                {isOpen ? (
                  <div className="space-y-2 px-3 pb-3">
                    <p className="text-[11px] font-medium text-muted-foreground">include any</p>
                    {field === 'stage' ? (
                      <Select
                        value={filters.stage ?? ''}
                        onValueChange={(v) => navigate({ ...filters, stage: v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a stage" /></SelectTrigger>
                        <SelectContent>
                          {stageOptions.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {field === 'tag' ? (
                      <Select
                        value={filters.tagsAny?.[0] ?? ''}
                        onValueChange={(v) => navigate({ ...filters, tagsAny: [v] })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a tag" /></SelectTrigger>
                        <SelectContent>
                          {tagOptions.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {field === 'q' ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const v = String(new FormData(e.currentTarget).get('qv') ?? '').trim()
                          navigate({ ...filters, q: v || undefined })
                        }}
                      >
                        <Input name="qv" defaultValue={filters.q ?? ''} placeholder="Name contains" className="h-8 text-xs" />
                      </form>
                    ) : null}
                    {!isDraft ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(field === 'stage' ? [filters.stage!] : field === 'tag' ? filters.tagsAny ?? [] : [filters.q!]).map((v) => (
                          <Badge key={v} variant="secondary" className="gap-1 pr-1 text-[11px]">
                            {v}
                            <button type="button" onClick={() => removeFilter(field)} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-muted">
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* §9.6 Clear filters */}
      {active.length > 0 ? (
        <button
          type="button"
          onClick={() => { setDraftFields(new Set()); navigate({}) }}
          className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
