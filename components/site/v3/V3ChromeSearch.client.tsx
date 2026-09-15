'use client'

/**
 * Public header Search — catalog MorphingSearch (beUI), not a house invent.
 * Client-open morph; suggest feed for instant places; ⌘K / Ctrl+K toggles it.
 * SITE-110 SearchMorph pattern, sized for chrome (icon on phone, pill on desk).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MorphingSearch,
  type MorphingSearchItem,
} from '@/components/motion/morphing-search'
import { flattenSuggestions, useSearchSuggest } from '@/components/search/SearchSuggest'
import { trackEvent } from '@/lib/tracking'

const PLACE_SEEDS: MorphingSearchItem[] = [
  { id: '/homes-for-sale/bend', title: 'Bend', description: 'City' },
  { id: '/homes-for-sale/redmond', title: 'Redmond', description: 'City' },
  { id: '/homes-for-sale/sisters', title: 'Sisters', description: 'City' },
  { id: '/homes-for-sale/sunriver', title: 'Sunriver', description: 'Community' },
  { id: '/communities/tetherow', title: 'Tetherow', description: 'Bend' },
  { id: '/homes-for-sale/prineville', title: 'Prineville', description: 'City' },
  { id: '/homes-for-sale/la-pine', title: 'La Pine', description: 'City' },
  { id: '/homes-for-sale/madras', title: 'Madras', description: 'City' },
]

export function V3ChromeSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [iconOnly, setIconOnly] = useState(true)
  const { suggestions } = useSearchSuggest(query)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 56.24rem)')
    const apply = () => setIconOnly(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen((next) => !next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = useMemo(() => {
    const typed = flattenSuggestions(suggestions)
      .filter(
        (item) =>
          item.kind === 'address' ||
          item.kind === 'city' ||
          item.kind === 'subdivision' ||
          item.kind === 'neighborhood' ||
          item.kind === 'zip',
      )
      .map((item) => ({
        id: item.href,
        title: item.label,
        description: item.sublabel,
      }))
    return typed.length > 0 ? typed : PLACE_SEEDS
  }, [suggestions])

  const onSelect = useCallback(
    (item: MorphingSearchItem) => {
      try {
        trackEvent('search', { surface: 'chrome', search_term: item.title })
      } catch {
        // tracking optional
      }
      setOpen(false)
      setQuery('')
      router.push(item.id)
    },
    [router],
  )

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
  }, [])

  return (
    <div className="v3-chrome__search">
      <MorphingSearch
        items={items}
        placeholder="Search homes, places…"
        iconOnly={iconOnly}
        open={open}
        onOpenChange={onOpenChange}
        onQueryChange={setQuery}
        onSelect={onSelect}
        shortcut=""
        emptyMessage="No places match that."
        className="v3-chrome__search-morph"
      />
    </div>
  )
}
