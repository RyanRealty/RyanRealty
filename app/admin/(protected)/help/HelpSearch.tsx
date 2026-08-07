'use client'

// 11D: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
// so /admin/help does not read half-migrated. Presentation only.
//
// Carried over verbatim: the substring filter over the pre-lowercased haystack,
// AREA_ORDER and the sort that puts unknown areas last, the per-area grouping,
// the /admin/help/<slug> hrefs, the search input's aria-label, and the
// no-match sentence.
//
// Shape changed, data did not: the shadcn Input became the kit's TextField
// (which owns the <input>, so this file has no raw control), the per-area
// <h2> became SectionHead, and the shadcn Card grid became hairline rows.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SectionHead, TextField } from '@/components/admin/v2'

export type SearchableArticle = {
  slug: string
  title: string
  area: string
  summary: string
  haystack: string
}

/** Mirror the admin nav's top-level grouping so the KB reads like the menu. */
const AREA_ORDER = ['Dashboard', 'CRM', 'Deals', 'Reports', 'Admin']

export default function HelpSearch({ articles }: { articles: SearchableArticle[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => a.haystack.includes(q))
  }, [articles, query])

  const grouped = useMemo(() => {
    const byArea = new Map<string, SearchableArticle[]>()
    for (const a of filtered) {
      const list = byArea.get(a.area) ?? []
      list.push(a)
      byArea.set(a.area, list)
    }
    const areas = [...byArea.keys()].sort((a, b) => {
      const ia = AREA_ORDER.indexOf(a)
      const ib = AREA_ORDER.indexOf(b)
      return (ia === -1 ? AREA_ORDER.length : ia) - (ib === -1 ? AREA_ORDER.length : ib)
    })
    return areas.map((area) => ({ area, items: byArea.get(area) ?? [] }))
  }, [filtered])

  return (
    <div>
      <div style={{ maxWidth: 420, marginBottom: 8 }}>
        <TextField
          label="Search help"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help, for example listing alert"
          aria-label="Search help articles"
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 16 }}>
          No articles match that search. Try a shorter word, like alert or newsletter.
        </p>
      ) : (
        grouped.map(({ area, items }) => (
          <section key={area} aria-label={area}>
            <SectionHead>{area}</SectionHead>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--a-border)' }}>
              {items.map((a) => (
                <li
                  key={a.slug}
                  style={{ padding: '12px 2px', borderBottom: '1px solid var(--a-border)' }}
                >
                  <Link
                    href={`/admin/help/${a.slug}`}
                    style={{ color: 'var(--a-accent)', fontWeight: 600 }}
                  >
                    {a.title}
                  </Link>
                  <p
                    style={{
                      fontSize: 'var(--a-text-sm)',
                      color: 'var(--a-text-2)',
                      margin: '2px 0 0',
                    }}
                  >
                    {a.summary}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
