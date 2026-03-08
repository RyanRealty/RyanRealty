'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateGeoPlace } from '../../actions/geo-places'
import type { GeoPlaceRow } from '../../actions/geo-places'

export default function AssignCommunity({
  cities,
  neighborhoods,
  communities,
}: {
  cities: GeoPlaceRow[]
  neighborhoods: GeoPlaceRow[]
  communities: GeoPlaceRow[]
}) {
  const [communityId, setCommunityId] = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAssign() {
    if (!communityId) return
    setLoading(true)
    try {
      await updateGeoPlace(communityId, { parent_id: neighborhoodId || null })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (communities.length === 0) return null

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="font-semibold text-zinc-900">Assign community to neighborhood</h2>
      <p className="mt-1 text-sm text-zinc-600">Set a community&apos;s parent to a neighborhood or leave under city.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Community</span>
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600">Neighborhood</span>
          <select
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">City only (no neighborhood)</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAssign}
          disabled={loading || !communityId}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Assign'}
        </button>
      </div>
    </section>
  )
}
