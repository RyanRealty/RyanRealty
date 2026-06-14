'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { homesForSalePath, listingsBrowsePath } from '@/lib/slug'
import { deleteSavedSearch } from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

  async function handleDelete(id: string) {
    await deleteSavedSearch(id)
    router.refresh()
  }

  return (
    <Card className="divide-y divide-border overflow-hidden p-0">
      {searches.map((s) => (
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
      ))}
    </Card>
  )
}
