'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cityEntityKey } from '@/lib/slug'
import { deleteSavedSearch } from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'

type Props = { searches: SavedSearchRow[]; className?: string }

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
  if (city && subdivision)
    return `/search/${cityEntityKey(city)}/${encodeURIComponent(subdivision)}${q ? `?${q}` : ''}`
  if (city) return `/search/${cityEntityKey(city)}${q ? `?${q}` : ''}`
  return `/listings${q ? `?${q}` : ''}`
}

function filterSummary(filters: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof filters.beds === 'number' && filters.beds > 0) parts.push(`${filters.beds}+ Beds`)
  if (typeof filters.baths === 'number' && filters.baths > 0) parts.push(`${filters.baths}+ Baths`)
  if (typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number') {
    const min = typeof filters.minPrice === 'number' ? `$${Math.round(filters.minPrice / 1000)}K` : ''
    const max = typeof filters.maxPrice === 'number' ? `$${Math.round(filters.maxPrice / 1000)}K` : ''
    parts.push([min, max].filter(Boolean).join('–') || 'Any price')
  }
  if (typeof filters.city === 'string' && filters.city.trim()) parts.push(filters.city.trim())
  if (typeof filters.statusFilter === 'string' && filters.statusFilter) parts.push(filters.statusFilter)
  return parts.length ? parts.join(', ') : 'Any filters'
}

export default function DashboardSearchesList({ searches, className = '' }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setDeletingId(id)
    await deleteSavedSearch(id)
    setConfirmId(null)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <ul className={`space-y-4 ${className}`}>
      {searches.map((s) => (
        <li
          key={s.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-900">{s.name || 'Saved search'}</h3>
              <p className="mt-0.5 text-sm text-zinc-500">{filterSummary(s.filters)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildSearchUrl(s.filters)}
                className="rounded-lg bg-[var(--brand-navy)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
              >
                View results
              </Link>
              <Link
                href={buildSearchUrl(s.filters)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Edit filters
              </Link>
              {confirmId === s.id ? (
                <>
                  <span className="text-sm text-zinc-500">Delete?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={!!deletingId}
                    className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === s.id ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="text-sm font-medium text-zinc-500 hover:text-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
