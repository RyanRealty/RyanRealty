'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { homesForSalePath } from '@/lib/slug'
import { deleteSavedSearch } from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import { Button } from "@/components/ui/button"

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
  return `/listings${q ? `?${q}` : ''}`
}

export default function SavedSearchesList({ searches }: Props) {
  const router = useRouter()

  async function handleDelete(id: string) {
    await deleteSavedSearch(id)
    router.refresh()
  }

  return (
    <ul className="mt-6 space-y-3">
      {searches.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <Link
            href={buildSearchUrl(s.filters)}
            className="font-medium text-foreground hover:underline"
          >
            {s.name}
          </Link>
          <Button
            type="button"
            onClick={() => handleDelete(s.id)}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  )
}
