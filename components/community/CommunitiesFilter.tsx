'use client'

import { useState, useMemo } from 'react'
import type { CommunityForIndex } from '@/lib/communities'
import CommunityCard from './CommunityCard'

type Props = {
  communities: CommunityForIndex[]
}

export default function CommunitiesFilter({ communities }: Props) {
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
      <label htmlFor="community-search" className="sr-only">
        Filter communities by name
      </label>
      <input
        id="community-search"
        type="search"
        placeholder="Search communities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full max-w-md rounded-lg border border-[var(--gray-border)] bg-white px-4 py-3 text-[var(--brand-navy)] placeholder:text-[var(--gray-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 text-[var(--text-secondary)]">
          No communities match your search.
        </p>
      )}
    </>
  )
}
