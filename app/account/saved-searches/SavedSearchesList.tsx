'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { homesForSalePath, listingsBrowsePath } from '@/lib/slug'
import { deleteSavedSearch, updateSavedSearch } from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = { searches: SavedSearchRow[] }

function buildSearchUrl(filters: Record<string, unknown>): string {
  const city = typeof filters.city === 'string' ? filters.city.trim() : undefined
  const subdivision = typeof filters.subdivision === 'string' ? filters.subdivision : undefined
  const params = new URLSearchParams()
  if (typeof filters.minPrice === 'number') params.set('minPrice', String(filters.minPrice))
  if (typeof filters.maxPrice === 'number') params.set('maxPrice', String(filters.maxPrice))
  if (typeof filters.beds === 'number') params.set('beds', String(filters.beds))
  if (typeof filters.baths === 'number') params.set('baths', String(filters.baths))
  if (typeof filters.minSqFt === 'number') params.set('minSqFt', String(filters.minSqFt))
  if (typeof filters.maxSqFt === 'number') params.set('maxSqFt', String(filters.maxSqFt))
  if (typeof filters.propertyType === 'string') params.set('propertyType', filters.propertyType)
  if (typeof filters.sort === 'string') params.set('sort', filters.sort)
  if (typeof filters.statusFilter === 'string') params.set('statusFilter', filters.statusFilter)
  if (filters.includeClosed === true) params.set('includeClosed', '1')
  const q = params.toString()
  if (city && subdivision) return `${homesForSalePath(city, subdivision)}${q ? `?${q}` : ''}`
  if (city) return `${homesForSalePath(city)}${q ? `?${q}` : ''}`
  return `${listingsBrowsePath()}${q ? `?${q}` : ''}`
}

export default function SavedSearchesList({ searches }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startRename(s: SavedSearchRow) {
    setEditingId(s.id)
    setDraftName(s.name || '')
    setError(null)
  }

  function cancelRename() {
    setEditingId(null)
    setDraftName('')
    setError(null)
    setSaving(false)
  }

  async function saveRename(id: string) {
    const next = draftName.trim()
    if (!next) {
      setError('Give this search a name.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await updateSavedSearch(id, { name: next })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    cancelRename()
    router.refresh()
  }

  async function handleDelete(id: string) {
    await deleteSavedSearch(id)
    router.refresh()
  }

  return (
    <Card className="divide-y divide-border overflow-hidden p-0">
      {searches.map((s) =>
        editingId === s.id ? (
          <div key={s.id} className="flex flex-col gap-2 px-4 py-3">
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void saveRename(s.id)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRename()
                }
              }}
              aria-label="Search name"
              aria-invalid={error ? true : undefined}
              maxLength={120}
              className="text-sm"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void saveRename(s.id)}
                disabled={saving}
                className="shrink-0"
              >
                {saving ? 'Saving' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelRename}
                disabled={saving}
                className="shrink-0 text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <Link
              href={buildSearchUrl(s.filters)}
              className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
            >
              <span className="block break-words text-sm font-medium text-foreground">{s.name || 'Untitled search'}</span>
              <span className="block text-xs text-muted-foreground">
                {typeof s.result_count === 'number' ? (
                  <span className="tabular-nums">{s.result_count} matches</span>
                ) : (
                  'Tap to view results'
                )}
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => startRename(s)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(s.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          </div>
        )
      )}
    </Card>
  )
}
