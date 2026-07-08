'use client'

/**
 * CommunityIndexBrowser — the long-tail community index for /communities.
 *
 * Replaces the previous 500-card grid (audit P0-5: the page rendered 61,884px
 * tall because every subdivision became a CommunityCard with an image, an
 * engagement bar, and client-side state). The long tail is now:
 *
 *   1. A search input that filters by community or city name.
 *   2. A collapsed alphabetical index (<details> per letter) of small text
 *      links. EVERY community link is server-rendered into the initial DOM —
 *      crawlers reach every /communities/<slug> URL — but the collapsed
 *      groups keep the rendered page height small.
 *
 * Hydration safety: no Date, no Math.random, no typeof-window branches.
 * Server and client render identical markup from the same props.
 */

import { useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useEngagementTracking } from '@/components/site/experience/useEngagementTracking'

export type CommunityIndexItem = {
  slug: string
  name: string
  city: string
  activeCount: number
}

const MATCH_CAP = 100

function letterOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}

function IndexLink({ item }: { item: CommunityIndexItem }) {
  return (
    <li className="break-inside-avoid py-1">
      <a
        href={`/communities/${item.slug}`}
        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        {item.name}
      </a>
      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
        {item.city}
        {item.activeCount > 0
          ? ` · ${item.activeCount} ${item.activeCount === 1 ? 'home' : 'homes'}`
          : ''}
      </span>
    </li>
  )
}

export default function CommunityIndexBrowser({ items }: { items: CommunityIndexItem[] }) {
  const [query, setQuery] = useState('')
  // "A to Z" only helps someone who already knows a community's name — a
  // relocating buyer building a mental model of the area had no way in
  // (~20 near-empty letter rows, no city grouping, no counts beyond a
  // letter). "By city" groups the same data a different way with zero new
  // fetches, sorted by community count so the biggest towns lead
  // (design-audit P3).
  const [viewMode, setViewMode] = useState<'az' | 'city'>('az')
  const searchedOnce = useRef(false)
  const { trackInteract } = useEngagementTracking('all-communities', { pageType: 'geo-hub' })

  // Group alphabetically once — items arrive pre-sorted from the server.
  const groups = useMemo(() => {
    const map = new Map<string, CommunityIndexItem[]>()
    for (const item of items) {
      const letter = letterOf(item.name)
      const arr = map.get(letter) ?? []
      arr.push(item)
      map.set(letter, arr)
    }
    return Array.from(map.entries())
  }, [items])

  const cityGroups = useMemo(() => {
    const map = new Map<string, CommunityIndexItem[]>()
    for (const item of items) {
      const arr = map.get(item.city) ?? []
      arr.push(item)
      map.set(item.city, arr)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [items])

  const q = query.trim().toLowerCase()
  const matches = q
    ? items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.city.toLowerCase().includes(q),
      )
    : null

  function onQueryChange(value: string) {
    setQuery(value)
    if (!searchedOnce.current && value.trim().length > 0) {
      searchedOnce.current = true
      trackInteract('search')
    }
  }

  return (
    <div>
      <Label htmlFor="community-search" className="sr-only">
        Search communities by name or city
      </Label>
      <Input
        id="community-search"
        type="search"
        placeholder="Search by community or city name"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="mt-2 w-full max-w-md"
        autoComplete="off"
      />

      {!matches ? (
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => {
            if (v === 'az' || v === 'city') {
              setViewMode(v)
              trackInteract(`browse-${v}`)
            }
          }}
          className="mt-4 inline-flex w-fit rounded-lg border border-border"
        >
          <ToggleGroupItem value="az" aria-label="Browse A to Z" className="text-xs">
            A to Z
          </ToggleGroupItem>
          <ToggleGroupItem value="city" aria-label="Browse by city" className="text-xs">
            By city
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}

      {matches ? (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground tabular-nums">
            {matches.length === 0
              ? 'No communities match your search.'
              : matches.length > MATCH_CAP
                ? `Showing ${MATCH_CAP} of ${matches.length} matches. Keep typing to narrow.`
                : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}
          </p>
          {matches.length > 0 ? (
            <ul className="mt-3 sm:columns-2 lg:columns-3 gap-x-8">
              {matches.slice(0, MATCH_CAP).map((item) => (
                <IndexLink key={item.slug} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border border-t border-b border-border">
          {(viewMode === 'city' ? cityGroups : groups).map(([label, rows]) => (
            <details key={label} className="group">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden"
                onClick={() => trackInteract(`expand-${label}`)}
              >
                <span className="font-display text-lg text-foreground">{label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'community' : 'communities'}
                  </span>
                  <span
                    aria-hidden
                    className="text-muted-foreground/50 transition-transform group-open:rotate-90"
                  >
                    &rsaquo;
                  </span>
                </span>
              </summary>
              <ul className="pb-4 sm:columns-2 lg:columns-3 gap-x-8">
                {rows.map((item) => (
                  <IndexLink key={item.slug} item={item} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
