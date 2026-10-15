'use client'

/**
 * UX review F28 (Matt approved 2026-10-15): a listing runs ~12,000px, so a
 * sticky row of section links lets a buyer jump to what they came for.
 * It reads the page's own h2s after mount (no second source of truth),
 * gives a matched heading an id when it has none, and shows only the
 * sections this listing actually has.
 */
import { useEffect, useState } from 'react'

const WANTED: Array<{ label: string; match: RegExp; id: string }> = [
  { label: 'Overview', match: /^(at a glance|quick facts)$/i, id: 'ld-overview' },
  { label: 'Facts', match: /^facts$/i, id: 'ld-facts' },
  { label: 'About', match: /^about this (home|property)/i, id: 'ld-about' },
  { label: 'Payment', match: /^payment/i, id: 'ld-payment' },
  { label: 'Schools', match: /^schools/i, id: 'ld-schools' },
  { label: 'History', match: /history/i, id: 'ld-history' },
  { label: 'Documents', match: /cc&rs|governing documents/i, id: 'ld-documents' },
]

type Item = { label: string; id: string }

export function ListingSectionNav() {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    const heads = [...document.querySelectorAll<HTMLHeadingElement>('main h2')]
    const found: Item[] = []
    for (const want of WANTED) {
      const h = heads.find((el) => want.match.test((el.textContent ?? '').trim()))
      if (!h) continue
      if (!h.id) h.id = want.id
      found.push({ label: want.label, id: h.id })
    }
    setItems(found.length >= 3 ? found : [])
  }, [])
  if (items.length === 0) return null
  return (
    <nav className="listing-section-nav" aria-label="Sections on this page">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
