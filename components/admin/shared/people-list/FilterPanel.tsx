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
import { Button, SearchField, ToolbarSelect } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

export type FilterOption = { key: string; label: string }

export type PeopleFilters = {
  q?: string
  stage?: string
  tagsAny?: string[]
  neighborhood?: string
}

export type FilterPanelProps = {
  filters: PeopleFilters
  stageOptions: FilterOption[]
  tagOptions: FilterOption[]
  neighborhoodOptions: FilterOption[]
  /** Params carried through every filter navigation (broker/pond/view). */
  carry: Record<string, string | undefined>
}

type FilterField = 'stage' | 'tag' | 'neighborhood' | 'q'

const FIELD_LABEL: Record<FilterField, string> = { stage: 'Stage', tag: 'Tags', neighborhood: 'Neighborhood', q: 'Name' }

export default function FilterPanel({ filters, stageOptions, tagOptions, neighborhoodOptions, carry }: FilterPanelProps) {
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
    if (next.neighborhood) p.set('neighborhood', next.neighborhood)
    const qs = p.toString()
    router.push(qs ? `/admin/crm?${qs}` : '/admin/crm')
  }

  const active: Array<{ field: FilterField; summary: string }> = []
  if (filters.stage) active.push({ field: 'stage', summary: `Stage includes any of: ${filters.stage}` })
  if (filters.tagsAny?.length) active.push({ field: 'tag', summary: `Tags include any of: ${filters.tagsAny.join(', ')}` })
  if (filters.neighborhood) active.push({ field: 'neighborhood', summary: `Neighborhood is: ${neighborhoodOptions.find((n) => n.key === filters.neighborhood)?.label ?? filters.neighborhood}` })
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
      neighborhood: field === 'neighborhood' ? undefined : filters.neighborhood,
    })
  }

  // "Add a filter" candidates matching the typed search, excluding present rows.
  const present = new Set(rows.map((r) => r.field))
  const candidates = (Object.keys(FIELD_LABEL) as FilterField[])
    .filter((f) => !present.has(f))
    .filter((f) => !search.trim() || FIELD_LABEL[f].toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div data-testid="filter-panel">
      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Add a filter"
        // type=text, not SearchField's default type=search: the browser's own
        // clear affordance was never part of this control.
        type="text"
        aria-label="Add a filter"
        style={{ width: '100%', maxWidth: 'none', minHeight: 36 }}
      />
      {search.trim() || (candidates.length > 0 && rows.length > 0) ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {candidates.map((f) => (
            <Button
              key={f}
              variant="quiet"
              onClick={() => addDraft(f)}
              style={{ minHeight: 28, padding: '0 8px', fontSize: 'var(--a-text-xs)' }}
            >
              + {FIELD_LABEL[f]}
            </Button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        /* §9.1 empty state */
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <SlidersHorizontal className="h-8 w-8" style={{ color: 'var(--a-text-2)', opacity: 0.5 }} aria-hidden />
          <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>No filters added yet</p>
          {candidates.length > 0 && !search.trim() ? (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {candidates.map((f) => (
                <Button
                  key={f}
                  variant="quiet"
                  onClick={() => addDraft(f)}
                  style={{ minHeight: 28, padding: '0 8px', fontSize: 'var(--a-text-xs)' }}
                >
                  + {FIELD_LABEL[f]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="mt-3"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-md)',
            background: 'var(--a-surface)',
          }}
        >
          {rows.map(({ field, summary, isDraft }, i) => {
            const isOpen = expanded.has(field) || isDraft
            return (
              <div key={field} style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}>
                <button
                  type="button"
                  onClick={() => toggleExpand(field)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--a-inset)]"
                  style={{ color: 'var(--a-text)' }}
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 truncate">{summary}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen ? 'rotate-180' : '')} style={{ color: 'var(--a-text-2)' }} aria-hidden />
                </button>
                {isOpen ? (
                  <div className="space-y-2 px-3 pb-3">
                    <p className="font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>include any</p>
                    {field === 'stage' ? (
                      <ToolbarSelect
                        aria-label="Pick a stage"
                        value={filters.stage ?? ''}
                        onChange={(e) => navigate({ ...filters, stage: e.target.value })}
                        style={{ width: '100%', maxWidth: 'none' }}
                      >
                        {/* `hidden` as well as `disabled`: the Radix Select this
                            replaced showed its placeholder on the TRIGGER only.
                            Without it the placeholder becomes a real (greyed)
                            row in the open list that was never there. */}
                        <option value="" disabled hidden>Pick a stage</option>
                        {stageOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </ToolbarSelect>
                    ) : null}
                    {field === 'tag' ? (
                      <ToolbarSelect
                        aria-label="Pick a tag"
                        value={filters.tagsAny?.[0] ?? ''}
                        onChange={(e) => navigate({ ...filters, tagsAny: [e.target.value] })}
                        style={{ width: '100%', maxWidth: 'none' }}
                      >
                        <option value="" disabled hidden>Pick a tag</option>
                        {tagOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </ToolbarSelect>
                    ) : null}
                    {field === 'neighborhood' ? (
                      <ToolbarSelect
                        aria-label="Pick a neighborhood"
                        value={filters.neighborhood ?? ''}
                        onChange={(e) => navigate({ ...filters, neighborhood: e.target.value })}
                        style={{ width: '100%', maxWidth: 'none' }}
                      >
                        <option value="" disabled hidden>Pick a neighborhood</option>
                        {neighborhoodOptions.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
                      </ToolbarSelect>
                    ) : null}
                    {field === 'q' ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const v = String(new FormData(e.currentTarget).get('qv') ?? '').trim()
                          navigate({ ...filters, q: v || undefined })
                        }}
                      >
                        <SearchField
                          name="qv"
                          type="text"
                          defaultValue={filters.q ?? ''}
                          placeholder="Name contains"
                          aria-label="Name contains"
                          style={{ width: '100%', maxWidth: 'none' }}
                        />
                      </form>
                    ) : null}
                    {!isDraft ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(field === 'stage' ? [filters.stage!] : field === 'tag' ? filters.tagsAny ?? [] : field === 'neighborhood' ? [neighborhoodOptions.find((n) => n.key === filters.neighborhood)?.label ?? filters.neighborhood!] : [filters.q!]).map((v) => (
                          <span
                            key={v}
                            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1"
                            style={{ background: 'var(--a-inset)', color: 'var(--a-text)', fontSize: 'var(--a-text-xs)' }}
                          >
                            {v}
                            <button type="button" onClick={() => removeFilter(field)} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-[var(--a-inset)]" style={{ color: 'var(--a-text-2)' }}>
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </span>
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
          className="mt-3 text-xs underline-offset-2 hover:underline"
          style={{ color: 'var(--a-text-2)' }}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
