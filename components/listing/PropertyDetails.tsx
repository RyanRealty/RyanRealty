'use client'

import { useState } from 'react'
import type { ListingDetailListing, ListingDetailCommunity } from '@/app/actions/listing-detail'
import { Card, CardContent } from '@/components/ui/card'
import PropertyTypeBadge from '@/components/ui/PropertyTypeBadge'
import { Button } from "@/components/ui/button"

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
      <h2 className="text-xl font-semibold text-primary">Property Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('property')}
              aria-expanded={openSections.property}
            >
              <span>Property Details</span>
              <span className="text-muted-foreground">{openSections.property ? '▼' : '▶'}</span>
            </Button>
            {openSections.property && (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {(listing.property_type || listing.property_sub_type) && (
                  <li className="flex items-center gap-2">
                    <span>Property Type:</span>
                    <PropertyTypeBadge value={listing.property_type} />
                    {listing.property_sub_type && <span className="text-foreground">· {listing.property_sub_type}</span>}
                  </li>
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
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('interior')}
              aria-expanded={openSections.interior}
            >
              <span>Interior Features</span>
              <span className="text-muted-foreground">{openSections.interior ? '▼' : '▶'}</span>
            </Button>
            {openSections.interior && (
              <div className="mt-3 flex flex-wrap gap-2">
                {interiorTags.length > 0
                  ? interiorTags.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                        {t}
                      </span>
                    ))
                  : <span className="text-sm text-muted-foreground">—</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('exterior')}
              aria-expanded={openSections.exterior}
            >
              <span>Exterior Features</span>
              <span className="text-muted-foreground">{openSections.exterior ? '▼' : '▶'}</span>
            </Button>
            {openSections.exterior && (
              <div className="mt-3 flex flex-wrap gap-2">
                {exteriorTags.length > 0
                  ? exteriorTags.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                        {t}
                      </span>
                    ))
                  : <span className="text-sm text-muted-foreground">—</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('heating')}
              aria-expanded={openSections.heating}
            >
              <span>Heating & Cooling</span>
              <span className="text-muted-foreground">{openSections.heating ? '▼' : '▶'}</span>
            </Button>
            {openSections.heating && (
              <p className="mt-3 text-sm text-foreground">
                {[listing.heating, listing.cooling].filter(Boolean).join(' · ') || '—'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('kitchen')}
              aria-expanded={openSections.kitchen}
            >
              <span>Kitchen & Appliances</span>
              <span className="text-muted-foreground">{openSections.kitchen ? '▼' : '▶'}</span>
            </Button>
            {openSections.kitchen && (
              <p className="mt-3 text-sm text-primary">{listing.kitchen_appliances?.trim() || '—'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button
              type="button"
              className="flex w-full items-center justify-between text-left font-medium text-foreground"
              onClick={() => toggle('community')}
              aria-expanded={openSections.community}
            >
              <span>Community Features</span>
              <span className="text-muted-foreground">{openSections.community ? '▼' : '▶'}</span>
            </Button>
            {openSections.community && (
              <ul className="mt-3 space-y-1 text-sm text-foreground">
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
