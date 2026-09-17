'use client'

/**
 * Public header Search — catalog MorphingSearch (beUI), not a house invent.
 * Client-open morph; suggest feed for instant places; ⌘K / Ctrl+K toggles it.
 * SITE-110 SearchMorph pattern, sized for chrome (icon on phone, pill on desk).
 */
import { Building2, Home, MapPinned, Trees } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MorphingSearch,
  type MorphingSearchItem,
} from '@/components/motion/morphing-search'
import { flattenSuggestions, useSearchSuggest } from '@/components/search/SearchSuggest'
import { suggestToMorphItem } from '@/components/search/suggest-morph'
import { trackEvent } from '@/lib/tracking'

const PLACE_SEEDS: MorphingSearchItem[] = [
  { id: '/homes-for-sale/bend', title: 'Bend', description: 'Cities · City', icon: Building2 },
  { id: '/homes-for-sale/redmond', title: 'Redmond', description: 'Cities · City', icon: Building2 },
  { id: '/homes-for-sale/sisters', title: 'Sisters', description: 'Cities · City', icon: Trees },
  { id: '/homes-for-sale/sunriver', title: 'Sunriver', description: 'Communities · Community', icon: Home },
  { id: '/communities/tetherow', title: 'Tetherow', description: 'Neighborhoods · Bend', icon: MapPinned },
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
    // Comprehensive (Matt 2026-09-16): every kind the suggest feed returns —
    // addresses, cities, subdivisions, neighborhoods, ZIPs, brokers, reports and
    // guides — not a hand-picked five. The feed already matched them to the
    // query; `keywords` carries that query so the morph's own substring filter
    // cannot drop a match the server made on a field the row does not print.
    const typed = flattenSuggestions(suggestions).map((item) =>
      suggestToMorphItem(item, { keywords: [query] }),
    )
    return typed.length > 0 ? typed : PLACE_SEEDS
  }, [suggestions, query])

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

  useEffect(() => {
    document.documentElement.classList.toggle('rr-chrome-search-open', open)
    return () => document.documentElement.classList.remove('rr-chrome-search-open')
  }, [open])

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
        // The chrome is sticky at z-index 100 (V3Chrome.css); the morph's
        // portal defaults to z-50, which put the open input row behind the
        // header on every page (Matt, phone, 2026-09-16). Above the chrome and
        // the Find-me stage (120), below the nav overlay (200).
        overlayClassName="z-[150]"
      />
    </div>
  )
}
