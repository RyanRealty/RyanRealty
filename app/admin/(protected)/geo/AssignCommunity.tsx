'use client'

// Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only: the updateGeoPlace(communityId, { parent_id:
// neighborhoodId || null }) call, the `communities.length === 0` early
// return, the empty "Select…" / "City only (no neighborhood)" option values
// (both empty strings — an empty neighborhood means "leave under city"), the
// disabled rule and the router.refresh() are unchanged. Both raw <select>s
// became SelectField and the raw <h2> became SectionHead.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateGeoPlace } from '@/app/actions/geo-places'
import type { GeoPlaceRow } from '@/app/actions/geo-places'
import { Button, SectionHead, SelectField } from '@/components/admin/v2'

export default function AssignCommunity({
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
    <section>
      <SectionHead>Assign community to neighborhood</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        Set a community&apos;s parent to a neighborhood or leave under city.
      </p>
      <div className="av2-inline-form">
        <SelectField
          label="Community"
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
        >
          <option value="">Select…</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Neighborhood"
          value={neighborhoodId}
          onChange={(e) => setNeighborhoodId(e.target.value)}
        >
          <option value="">City only (no neighborhood)</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </SelectField>
        <Button
          type="button"
          variant="quiet"
          onClick={handleAssign}
          disabled={loading || !communityId}
        >
          {loading ? 'Saving…' : 'Assign'}
        </Button>
      </div>
    </section>
  )
}
