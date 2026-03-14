'use client'

import { useState, useMemo } from 'react'
import type { CommunityForIndex } from '@/lib/communities'
import type { CommunityEngagementCounts } from '@/app/actions/community-engagement'
import CommunityCard from './CommunityCard'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  communities: CommunityForIndex[]
  signedIn?: boolean
  savedKeys?: string[]
  likedKeys?: string[]
  engagementMap?: Record<string, CommunityEngagementCounts>
}

export default function CommunitiesFilter({
  communities,
  signedIn = false,
  savedKeys = [],
  likedKeys = [],
  engagementMap = {},
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return communities
    return communities.filter(
      (c) =>
        c.subdivision.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    )
  }, [communities, query])

  return (
    <>
      <Label htmlFor="community-search" className="sr-only">
        Filter communities by name
      </Label>
      <Input
        id="community-search"
        type="search"
        placeholder="Search communities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full max-w-md rounded-lg border border-border bg-card px-4 py-3 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {filtered.map((c) => (
          <CommunityCard
            key={c.slug}
            slug={c.slug}
            name={c.subdivision}
            city={c.city}
            activeCount={c.activeCount}
            medianPrice={c.medianPrice}
            heroImageUrl={c.heroImageUrl}
            isResort={c.isResort}
            size="default"
            signedIn={signedIn}
            saved={savedKeys.includes(c.entityKey)}
            liked={likedKeys.includes(c.entityKey)}
            engagement={engagementMap[c.entityKey] ?? null}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 text-muted-foreground">
          No communities match your search.
        </p>
      )}
    </>
  )
}
