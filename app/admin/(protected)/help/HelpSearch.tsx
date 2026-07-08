'use client'

/**
 * HelpSearch — client-side search + area-grouped listing for /admin/help.
 * Substring match over title, summary, and body (pre-lowercased server-side).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
    <div className="space-y-8">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help, for example listing alert"
          aria-label="Search help articles"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No articles match that search. Try a shorter word, like alert or newsletter.
        </p>
      ) : (
        grouped.map(({ area, items }) => (
          <section key={area} aria-label={area}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {area}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <Link key={a.slug} href={`/admin/help/${a.slug}`} className="group block">
                  <Card className="h-full p-4 transition-colors group-hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground group-hover:underline">
                        {a.title}
                      </p>
                      <Badge variant="outline" className="shrink-0 py-0 text-xs">
                        {a.area}
                      </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{a.summary}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
