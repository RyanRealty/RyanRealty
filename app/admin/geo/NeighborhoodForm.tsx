'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGeoPlace } from '../../actions/geo-places'
import type { GeoPlaceRow } from '../../actions/geo-places'

export default function NeighborhoodForm({
  cities,
  selectedCityId,
}: {
  cities: GeoPlaceRow[]
  selectedCityId?: string
}) {
  const [cityId, setCityId] = useState(selectedCityId ?? cities[0]?.id ?? '')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await createGeoPlace({
        type: 'neighborhood',
        parentId: cityId || null,
        name: name.trim(),
      })
      if (res.ok) {
        setName('')
        router.refresh()
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }

  if (cities.length === 0) return null

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="font-semibold text-zinc-900">Create neighborhood</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">City</span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Neighborhood name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. West Side"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
