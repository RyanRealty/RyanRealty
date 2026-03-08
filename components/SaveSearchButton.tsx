'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createSavedSearch } from '@/app/actions/saved-searches'

type Props = { user: boolean }

export default function SaveSearchButton({ user }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  if (!user) return null

  function buildFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = {}
    const parts = pathname?.split('/').filter(Boolean) ?? []
    if (parts[0] === 'search') {
      if (parts[1]) filters.city = decodeURIComponent(parts[1]).trim()
      if (parts[2]) filters.subdivision = decodeURIComponent(parts[2])
    }
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const beds = searchParams.get('beds')
    const baths = searchParams.get('baths')
    const minSqFt = searchParams.get('minSqFt')
    const maxSqFt = searchParams.get('maxSqFt')
    const propertyType = searchParams.get('propertyType')
    const sort = searchParams.get('sort')
    const statusFilter = searchParams.get('statusFilter')
    const includeClosed = searchParams.get('includeClosed')
    if (minPrice) filters.minPrice = Number(minPrice)
    if (maxPrice) filters.maxPrice = Number(maxPrice)
    if (beds) filters.beds = Number(beds)
    if (baths) filters.baths = Number(baths)
    if (minSqFt) filters.minSqFt = Number(minSqFt)
    if (maxSqFt) filters.maxSqFt = Number(maxSqFt)
    if (propertyType) filters.propertyType = propertyType
    if (sort) filters.sort = sort
    if (statusFilter) filters.statusFilter = statusFilter
    if (includeClosed === '1') filters.includeClosed = true
    return filters
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const result = await createSavedSearch(name.trim() || 'My search', buildFilters())
    setStatus(result.error ? 'error' : 'done')
    if (!result.error) {
      setName('')
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        Save this search
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <form
            onSubmit={handleSave}
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
          >
            <label className="block text-sm font-medium text-zinc-700">Name this search</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bend under $600k"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={status === 'saving'}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {status === 'saving' ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700"
              >
                Cancel
              </button>
            </div>
            {status === 'done' && <p className="mt-2 text-sm text-green-600">Saved.</p>}
            {status === 'error' && <p className="mt-2 text-sm text-red-600">Could not save. Try again.</p>}
          </form>
        </>
      )}
    </div>
  )
}
