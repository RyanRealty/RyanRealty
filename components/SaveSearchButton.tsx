'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createSavedSearch } from '@/app/actions/saved-searches'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from '@/components/ui/checkbox'

type Props = { user: boolean }

export default function SaveSearchButton({ user }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  if (!user) return null

  function buildFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = {}
    const parts = pathname?.split('/').filter(Boolean) ?? []
    if (parts[0] === 'search' || parts[0] === 'homes-for-sale') {
      if (parts[1]) filters.city = decodeURIComponent(parts[1]).trim()
      if (parts[2]) filters.subdivision = decodeURIComponent(parts[2])
    }
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const beds = searchParams.get('beds')
    const baths = searchParams.get('baths')
    const minSqFt = searchParams.get('minSqFt')
    const maxSqFt = searchParams.get('maxSqFt')
    const propertyType = searchParams.get('propertyType')
    const sort = searchParams.get('sort')
    const statusFilter = searchParams.get('statusFilter')
    const includeClosed = searchParams.get('includeClosed')
    const view = searchParams.get('view')
    const poly = searchParams.get('poly')
    if (minPrice) filters.minPrice = Number(minPrice)
    if (maxPrice) filters.maxPrice = Number(maxPrice)
    if (beds) filters.beds = Number(beds)
    if (baths) filters.baths = Number(baths)
    if (minSqFt) filters.minSqFt = Number(minSqFt)
    if (maxSqFt) filters.maxSqFt = Number(maxSqFt)
    if (propertyType) filters.propertyType = propertyType
    if (sort) filters.sort = sort
    if (statusFilter) filters.statusFilter = statusFilter
    if (includeClosed === '1') filters.includeClosed = true
    if (view) filters.view = view
    if (poly) filters.poly = poly
    return filters
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const trimmedName = name.trim() || 'My search'
    const filters = buildFilters()
    const result = await createSavedSearch(trimmedName, filters, {
      isPublic,
      publicTitle: isPublic ? trimmedName : undefined,
    })
    setStatus(result.error ? 'error' : 'done')
    if (!result.error) {
      // High-intent event: visitor saved a search, expects alerts on new matches.
      // Carries the filter dimensions so we can answer "which buyer criteria
      // are most common" from the GA4 event taxonomy.
      try {
        trackEvent('save_search', {
          name: trimmedName.slice(0, 64),
          city: typeof filters.city === 'string' ? filters.city.slice(0, 64) : undefined,
          subdivision: typeof filters.subdivision === 'string' ? filters.subdivision.slice(0, 64) : undefined,
          min_price: typeof filters.minPrice === 'number' ? filters.minPrice : undefined,
          max_price: typeof filters.maxPrice === 'number' ? filters.maxPrice : undefined,
          beds: typeof filters.beds === 'number' ? filters.beds : undefined,
          baths: typeof filters.baths === 'number' ? filters.baths : undefined,
          property_type: typeof filters.propertyType === 'string' ? filters.propertyType : undefined,
          is_public: isPublic,
        })
      } catch {
        // never block UX on tracking
      }
      setName('')
      setIsPublic(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
      >
        Save this search
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <form
            onSubmit={handleSave}
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-4 shadow-md"
          >
            <Label className="block text-sm font-medium text-muted-foreground">Name this search</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bend under $600k"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-3 flex items-start gap-2">
              <Checkbox
                id="save-search-public"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <Label htmlFor="save-search-public" className="text-sm text-muted-foreground">
                Make this search public for the Popular Searches section
              </Label>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="submit"
                disabled={status === 'saving'}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {status === 'saving' ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
            {status === 'done' && <p className="mt-2 text-sm text-success">Saved.</p>}
            {status === 'error' && <p className="mt-2 text-sm text-destructive">Could not save. Try again.</p>}
          </form>
        </>
      )}
    </div>
  )
}
