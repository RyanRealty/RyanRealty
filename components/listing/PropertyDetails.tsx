'use client'

import { useState } from 'react'
import type { ListingDetailListing, ListingDetailCommunity } from '@/app/actions/listing-detail'
import Card, { CardContent } from '@/components/ui/Card'

function parseList(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

type Props = {
  listing: ListingDetailListing
  community: ListingDetailCommunity | null
}

export default function PropertyDetails({ listing, community }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    property: true,
    interior: true,
    exterior: true,
    heating: false,
    kitchen: false,
    community: false,
  })

  const toggle = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const interiorTags = parseList(listing.interior_features)
  const exteriorTags = parseList(listing.exterior_features)

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--brand-navy)]">Property Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('property')}
              aria-expanded={openSections.property}
            >
              <span>Property Details</span>
              <span className="text-[var(--gray-muted)]">{openSections.property ? '▼' : '▶'}</span>
            </button>
            {openSections.property && (
              <ul className="mt-3 space-y-2 text-sm text-[var(--brand-navy)]">
                {(listing.property_type || listing.property_sub_type) && (
                  <li>Property Type: {[listing.property_type, listing.property_sub_type].filter(Boolean).join(' · ')}</li>
                )}
                {listing.year_built != null && <li>Year Built: {listing.year_built}</li>}
                {listing.architectural_style && <li>Architectural Style: {listing.architectural_style}</li>}
                {listing.construction_materials && <li>Construction: {listing.construction_materials}</li>}
                {listing.roof && <li>Roof: {listing.roof}</li>}
                {listing.flooring && <li>Flooring: {listing.flooring}</li>}
                {listing.levels != null && <li>Levels: {listing.levels}</li>}
                {listing.garage_spaces != null && <li>Garage: {listing.garage_spaces} spaces</li>}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('interior')}
              aria-expanded={openSections.interior}
            >
              <span>Interior Features</span>
              <span className="text-[var(--gray-muted)]">{openSections.interior ? '▼' : '▶'}</span>
            </button>
            {openSections.interior && (
              <div className="mt-3 flex flex-wrap gap-2">
                {interiorTags.length > 0
                  ? interiorTags.map((t) => (
                      <span key={t} className="rounded-full bg-[var(--gray-bg)] px-3 py-1 text-sm text-[var(--brand-navy)]">
                        {t}
                      </span>
                    ))
                  : <span className="text-sm text-[var(--gray-muted)]">—</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('exterior')}
              aria-expanded={openSections.exterior}
            >
              <span>Exterior Features</span>
              <span className="text-[var(--gray-muted)]">{openSections.exterior ? '▼' : '▶'}</span>
            </button>
            {openSections.exterior && (
              <div className="mt-3 flex flex-wrap gap-2">
                {exteriorTags.length > 0
                  ? exteriorTags.map((t) => (
                      <span key={t} className="rounded-full bg-[var(--gray-bg)] px-3 py-1 text-sm text-[var(--brand-navy)]">
                        {t}
                      </span>
                    ))
                  : <span className="text-sm text-[var(--gray-muted)]">—</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('heating')}
              aria-expanded={openSections.heating}
            >
              <span>Heating & Cooling</span>
              <span className="text-[var(--gray-muted)]">{openSections.heating ? '▼' : '▶'}</span>
            </button>
            {openSections.heating && (
              <p className="mt-3 text-sm text-[var(--brand-navy)]">
                {[listing.heating, listing.cooling].filter(Boolean).join(' · ') || '—'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('kitchen')}
              aria-expanded={openSections.kitchen}
            >
              <span>Kitchen & Appliances</span>
              <span className="text-[var(--gray-muted)]">{openSections.kitchen ? '▼' : '▶'}</span>
            </button>
            {openSections.kitchen && (
              <p className="mt-3 text-sm text-[var(--brand-navy)]">{listing.kitchen_appliances?.trim() || '—'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-[var(--brand-navy)]"
              onClick={() => toggle('community')}
              aria-expanded={openSections.community}
            >
              <span>Community Features</span>
              <span className="text-[var(--gray-muted)]">{openSections.community ? '▼' : '▶'}</span>
            </button>
            {openSections.community && (
              <ul className="mt-3 space-y-1 text-sm text-[var(--brand-navy)]">
                {listing.pool_features && <li>Pool: {listing.pool_features}</li>}
                {listing.waterfront_yn && <li>Waterfront</li>}
                {listing.view && <li>View: {listing.view}</li>}
                {listing.senior_community_yn && <li>Senior Community</li>}
                {community && <li>Community: {community.name}</li>}
                {!listing.pool_features && !listing.waterfront_yn && !listing.view && !listing.senior_community_yn && !community && <li>—</li>}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
