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
 *
 * ON THE v3 REGISTER SINCE 2026-09-02. It used shadcn's Input, Label and
 * ToggleGroup from @/components/ui and painted from the radix-nova stone
 * neutral, so a public page carried two registers, two neutrals and two corner
 * radii. The controls are barrel atoms now (V3Filter, V3Segmented) and the
 * rows are the register's own — which also raised 600 links from 14px text in
 * an 18px box to a 44px row.
 */

import { useMemo, useRef, useState } from 'react'
import { V3Filter, V3Segmented } from '@/components/site/v3'
import { useEngagementTracking } from '@/components/site/experience/useEngagementTracking'
import './community-index.css'

export type CommunityIndexItem = {
  slug: string
  name: string
  city: string
  activeCount: number
  /** Defaults to `/communities/${slug}` so the communities index stays unchanged. */
  href?: string
}

const MATCH_CAP = 100

function letterOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}

function itemHref(item: CommunityIndexItem): string {
  return item.href ?? `/communities/${item.slug}`
}

function IndexLink({ item }: { item: CommunityIndexItem }) {
  const where =
    item.activeCount > 0
      ? `${item.city} · ${item.activeCount} ${item.activeCount === 1 ? 'home' : 'homes'}`
      : item.city
  return (
    <li className="community-index__row">
      {/* The whole row is the door. The city and the count used to sit OUTSIDE
          the anchor, so the target was the name alone. */}
      <a href={itemHref(item)} className="community-index__link">
        <span className="community-index__name">{item.name}</span>
        <span className="community-index__where">{where}</span>
      </a>
    </li>
  )
}

type CommunityIndexBrowserProps = {
  items: CommunityIndexItem[]
  searchLabel?: string
  searchPlaceholder?: string
  emptyLabel?: string
  countNoun?: { singular: string; plural: string }
}

export default function CommunityIndexBrowser({
  items,
  searchLabel = 'Search communities by name or city',
  searchPlaceholder = 'Search by community or city name',
  emptyLabel = 'No communities match your search.',
  countNoun = { singular: 'community', plural: 'communities' },
}: CommunityIndexBrowserProps) {
  const [query, setQuery] = useState('')
  // "A to Z" only helps someone who already knows a community's name — a
  // relocating buyer building a mental model of the area had no way in
  // (~20 near-empty letter rows, no city grouping, no counts beyond a
  // letter). "By city" groups the same data a different way with zero new
  // fetches, sorted by community count so the biggest towns lead
  // (design-audit P3).
  const [viewMode, setViewMode] = useState<'az' | 'city'>('az')
  const searchedOnce = useRef(false)
  const { trackInteract } = useEngagementTracking('all-communities')

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
      <div className="community-index__controls">
        <V3Filter
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={query}
          onValueChange={onQueryChange}
        />
        {!matches ? (
          <V3Segmented
            label="How to browse"
            options={[
              { key: 'az', label: 'A to Z' },
              { key: 'city', label: 'By city' },
            ]}
            value={viewMode}
            onValueChange={(v) => {
              if (v === 'az' || v === 'city') {
                setViewMode(v)
                trackInteract(`browse-${v}`)
              }
            }}
          />
        ) : null}
      </div>

      {matches ? (
        <div>
          <p className="community-index__count">
            {matches.length === 0
              ? emptyLabel
              : matches.length > MATCH_CAP
                ? `Showing ${MATCH_CAP} of ${matches.length} matches. Keep typing to narrow.`
                : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}
          </p>
          {matches.length > 0 ? (
            <ul className="community-index__list">
              {matches.slice(0, MATCH_CAP).map((item) => (
                <IndexLink key={itemHref(item)} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="community-index__groups">
          {(viewMode === 'city' ? cityGroups : groups).map(([label, rows]) => (
            <details key={label} className="community-index__group">
              <summary
                className="community-index__summary"
                onClick={() => trackInteract(`expand-${label}`)}
              >
                <span className="community-index__label">{label}</span>
                <span className="community-index__meta">
                  <span>
                    {rows.length} {rows.length === 1 ? countNoun.singular : countNoun.plural}
                  </span>
                  <span aria-hidden className="community-index__mark">
                    &rsaquo;
                  </span>
                </span>
              </summary>
              <ul className="community-index__list">
                {rows.map((item) => (
                  <IndexLink key={itemHref(item)} item={item} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
